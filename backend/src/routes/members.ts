import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    authenticate,
    asyncHandler,
    requireTenant,
    ValidationError,
    NotFoundError,
    ForbiddenError
} from '../middleware';
import { Role, RoleHierarchy, TenantMember, InvitationStatus, Invitation } from '../types';
import { tenants, tenantMembers } from './tenants';

const router = Router();

// In-memory invitation store
const invitations = new Map<string, Invitation>();

/**
 * @route GET /api/v1/members
 * @desc Get all members of current tenant
 * @access Private (viewer+)
 */
router.get('/', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    // Verify user is a member
    const userMembership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);

    if (!userMembership) {
        throw new ForbiddenError('You are not a member of this tenant');
    }

    // Get all members
    const members = Array.from(tenantMembers.values())
        .filter(m => m.tenantId === tenantId)
        .map(m => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            joinedAt: m.joinedAt,
            isSuspended: m.isSuspended,
            // TODO: Join with user data from database
        }));

    res.json({
        success: true,
        data: members,
        meta: {
            total: members.length,
        },
    });
}));

/**
 * @route POST /api/v1/members/invite
 * @desc Invite a new member to tenant
 * @access Private (admin+)
 */
router.post('/invite', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { email, role = Role.VIEWER } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    if (!email) {
        throw new ValidationError('Email is required');
    }

    // Validate role
    if (![Role.ADMIN, Role.EDITOR, Role.VIEWER].includes(role)) {
        throw new ValidationError('Invalid role. Cannot invite as owner.');
    }

    // Check if inviter has permission
    const inviterMembership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);

    if (!inviterMembership) {
        throw new ForbiddenError('You are not a member of this tenant');
    }

    // Must be admin or owner to invite
    if (inviterMembership.role !== Role.OWNER && inviterMembership.role !== Role.ADMIN) {
        throw new ForbiddenError('Only admins and owners can invite members');
    }

    // Check if already a pending invitation
    const existingInvite = Array.from(invitations.values())
        .find(i => i.tenantId === tenantId && i.email === email.toLowerCase() && i.status === InvitationStatus.PENDING);

    if (existingInvite) {
        throw new ValidationError('An invitation for this email is already pending');
    }

    // Create invitation
    const invitation: Invitation = {
        id: uuidv4(),
        tenantId,
        email: email.toLowerCase(),
        role,
        status: InvitationStatus.PENDING,
        invitedBy: userId,
        token: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    invitations.set(invitation.id, invitation);

    // TODO: Send invitation email

    res.status(201).json({
        success: true,
        data: {
            invitationId: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
            inviteLink: `/invite/${invitation.token}`,
        },
    });
}));

/**
 * @route POST /api/v1/members/invitations/:token/accept
 * @desc Accept an invitation
 * @access Private
 */
router.post('/invitations/:token/accept', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const userId = req.user!.id;

    const invitation = Array.from(invitations.values())
        .find(i => i.token === token);

    if (!invitation) {
        throw new NotFoundError('Invitation');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
        throw new ValidationError(`Invitation has already been ${invitation.status}`);
    }

    if (new Date() > invitation.expiresAt) {
        invitation.status = InvitationStatus.EXPIRED;
        throw new ValidationError('Invitation has expired');
    }

    // Check if user email matches invitation email
    if (req.user!.email.toLowerCase() !== invitation.email) {
        throw new ForbiddenError('This invitation was sent to a different email address');
    }

    // Check if already a member
    const existingMembership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === invitation.tenantId && m.userId === userId);

    if (existingMembership) {
        throw new ValidationError('You are already a member of this tenant');
    }

    // Create membership
    const membership: TenantMember = {
        id: uuidv4(),
        tenantId: invitation.tenantId,
        userId,
        role: invitation.role,
        joinedAt: new Date(),
        invitedBy: invitation.invitedBy,
        isSuspended: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    tenantMembers.set(membership.id, membership);

    // Update invitation status
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.updatedAt = new Date();

    res.json({
        success: true,
        data: {
            message: 'Invitation accepted successfully',
            tenant: tenants.get(invitation.tenantId),
            role: membership.role,
        },
    });
}));

/**
 * @route PUT /api/v1/members/:memberId/role
 * @desc Update member role
 * @access Private (admin+)
 */
router.put('/:memberId/role', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const { role } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    if (!role || !Object.values(Role).includes(role)) {
        throw new ValidationError('Valid role is required');
    }

    // Get the member to update
    const targetMember = tenantMembers.get(memberId);
    if (!targetMember || targetMember.tenantId !== tenantId) {
        throw new NotFoundError('Member', memberId);
    }

    // Get current user's membership
    const currentMembership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);

    if (!currentMembership) {
        throw new ForbiddenError('You are not a member of this tenant');
    }

    // Permission checks
    const currentLevel = RoleHierarchy[currentMembership.role];
    const targetLevel = RoleHierarchy[targetMember.role];
    const newLevel = RoleHierarchy[role as Role];

    // Cannot change owner role
    if (targetMember.role === Role.OWNER) {
        throw new ForbiddenError('Cannot change the role of an owner');
    }

    // Cannot promote to owner
    if (role === Role.OWNER) {
        throw new ForbiddenError('Cannot promote to owner. Use ownership transfer instead.');
    }

    // Must have higher role than target
    if (currentLevel <= targetLevel) {
        throw new ForbiddenError('Cannot modify role of someone with equal or higher role');
    }

    // Cannot promote above own role
    if (newLevel >= currentLevel && currentMembership.role !== Role.OWNER) {
        throw new ForbiddenError('Cannot promote member to a role equal or higher than your own');
    }

    // Update role
    targetMember.role = role;
    targetMember.updatedAt = new Date();

    res.json({
        success: true,
        data: targetMember,
    });
}));

/**
 * @route DELETE /api/v1/members/:memberId
 * @desc Remove member from tenant
 * @access Private (admin+) or self
 */
router.delete('/:memberId', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const targetMember = tenantMembers.get(memberId);
    if (!targetMember || targetMember.tenantId !== tenantId) {
        throw new NotFoundError('Member', memberId);
    }

    // Cannot remove owner
    if (targetMember.role === Role.OWNER) {
        throw new ForbiddenError('Cannot remove the owner. Transfer ownership first.');
    }

    const currentMembership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);

    if (!currentMembership) {
        throw new ForbiddenError('You are not a member of this tenant');
    }

    // Allow self-removal or admin+ removal
    const isSelf = targetMember.userId === userId;
    const isAdmin = currentMembership.role === Role.OWNER || currentMembership.role === Role.ADMIN;

    if (!isSelf && !isAdmin) {
        throw new ForbiddenError('You do not have permission to remove this member');
    }

    // Check role hierarchy for admins
    if (!isSelf) {
        const currentLevel = RoleHierarchy[currentMembership.role];
        const targetLevel = RoleHierarchy[targetMember.role];

        if (currentLevel <= targetLevel) {
            throw new ForbiddenError('Cannot remove someone with equal or higher role');
        }
    }

    // Remove member
    tenantMembers.delete(memberId);

    res.json({
        success: true,
        data: {
            message: 'Member removed successfully',
        },
    });
}));

/**
 * @route PUT /api/v1/members/:memberId/suspend
 * @desc Suspend a member
 * @access Private (admin+)
 */
router.put('/:memberId/suspend', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const targetMember = tenantMembers.get(memberId);
    if (!targetMember || targetMember.tenantId !== tenantId) {
        throw new NotFoundError('Member', memberId);
    }

    // Cannot suspend owner or self
    if (targetMember.role === Role.OWNER) {
        throw new ForbiddenError('Cannot suspend the owner');
    }

    if (targetMember.userId === userId) {
        throw new ForbiddenError('Cannot suspend yourself');
    }

    const currentMembership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);

    if (!currentMembership || (currentMembership.role !== Role.OWNER && currentMembership.role !== Role.ADMIN)) {
        throw new ForbiddenError('Admin access required');
    }

    // Check role hierarchy
    if (RoleHierarchy[currentMembership.role] <= RoleHierarchy[targetMember.role]) {
        throw new ForbiddenError('Cannot suspend someone with equal or higher role');
    }

    targetMember.isSuspended = true;
    targetMember.updatedAt = new Date();

    res.json({
        success: true,
        data: targetMember,
    });
}));

export default router;
