import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../config/database';
import {
    authenticate,
    requireTenant,
    requireMinRole,
    requireAdmin,
    asyncHandler,
    ValidationError,
    NotFoundError,
    ForbiddenError,
} from '../middleware';
import { Role } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route GET /api/v1/members
 * @desc Get all members of a tenant
 * @access Private (Viewer+)
 */
router.get('/', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;

    const result = await pool.request()
        .input('tenant_id', tenantId)
        .query(`
            SELECT 
                tm.id, tm.tenant_id, tm.user_id, tm.role, tm.joined_at, tm.is_suspended,
                u.name, u.email, u.avatar_url
            FROM tenant_members tm
            INNER JOIN users u ON tm.user_id = u.id
            WHERE tm.tenant_id = @tenant_id
            ORDER BY tm.role DESC, tm.joined_at ASC
        `);

    const members = result.recordset.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        role: row.role,
        joinedAt: row.joined_at,
        isSuspended: row.is_suspended,
    }));

    res.json({
        success: true,
        data: members,
    });
}));

/**
 * @route POST /api/v1/members/invite
 * @desc Invite a user to the tenant
 * @access Private (Admin+)
 */
router.post('/invite', authenticate, requireTenant, requireMinRole(Role.ADMIN), asyncHandler(async (req: Request, res: Response) => {
    const { email, role } = req.body;
    const tenantId = req.tenantId!;
    const inviterId = req.user!.id;

    if (!email || !role) {
        throw new ValidationError('Email and role are required');
    }

    // Validate role
    const validRoles = [Role.VIEWER, Role.EDITOR, Role.ADMIN];
    if (!validRoles.includes(role)) {
        throw new ValidationError('Invalid role. Must be VIEWER, EDITOR, or ADMIN');
    }

    // Check if user exists
    const userResult = await pool.request()
        .input('email', email.toLowerCase())
        .query('SELECT id FROM users WHERE email = @email');

    let inviteeId: string | null = null;
    if (userResult.recordset.length > 0) {
        inviteeId = userResult.recordset[0].id;

        // Check if already a member
        const memberCheck = await pool.request()
            .input('tenant_id', tenantId)
            .input('user_id', inviteeId)
            .query('SELECT id FROM tenant_members WHERE tenant_id = @tenant_id AND user_id = @user_id');

        if (memberCheck.recordset.length > 0) {
            throw new ValidationError('User is already a member of this tenant');
        }
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const result = await pool.request()
        .input('tenant_id', tenantId)
        .input('email', email.toLowerCase())
        .input('role', role)
        .input('token', token)
        .input('invited_by', inviterId)
        .input('invitee_id', inviteeId)
        .input('expires_at', expiresAt)
        .query(`
            INSERT INTO invitations (id, tenant_id, email, role, token, invited_by, invitee_id, expires_at, created_at)
            OUTPUT INSERTED.*
            VALUES (NEWID(), @tenant_id, @email, @role, @token, @invited_by, @invitee_id, @expires_at, GETUTCDATE())
        `);

    const invitation = result.recordset[0];

    logger.info('Invitation created', { tenantId, email, role, inviterId });

    // TODO: Send invitation email
    logger.info('Invitation token (implement email sending)', {
        invitationId: invitation.id,
        token: invitation.token
    });

    res.status(201).json({
        success: true,
        data: {
            id: invitation.id,
            tenantId: invitation.tenant_id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expires_at,
            invitationLink: `${process.env.FRONTEND_URL}/invite/${token}`,
        },
        message: 'Invitation sent successfully',
    });
}));

/**
 * @route POST /api/v1/members/invite/:token/accept
 * @desc Accept an invitation
 * @access Private
 */
router.post('/invite/:token/accept', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const userId = req.user!.id;

    // Find valid invitation
    const invitationResult = await pool.request()
        .input('token', token)
        .query(`
            SELECT * FROM invitations
            WHERE token = @token 
            AND status = 'pending'
            AND expires_at > GETUTCDATE()
        `);

    if (invitationResult.recordset.length === 0) {
        throw new NotFoundError('Invalid or expired invitation');
    }

    const invitation = invitationResult.recordset[0];

    // Verify email matches (if user exists)
    const userResult = await pool.request()
        .input('user_id', userId)
        .query('SELECT email FROM users WHERE id = @user_id');

    if (userResult.recordset[0].email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new ForbiddenError('This invitation is for a different email address');
    }

    // Check if already a member
    const memberCheck = await pool.request()
        .input('tenant_id', invitation.tenant_id)
        .input('user_id', userId)
        .query('SELECT id FROM tenant_members WHERE tenant_id = @tenant_id AND user_id = @user_id');

    if (memberCheck.recordset.length > 0) {
        throw new ValidationError('You are already a member of this tenant');
    }

    // Add member
    const memberResult = await pool.request()
        .input('tenant_id', invitation.tenant_id)
        .input('user_id', userId)
        .input('role', invitation.role)
        .input('invited_by', invitation.invited_by)
        .query(`
            INSERT INTO tenant_members (id, tenant_id, user_id, role, joined_at, invited_by, is_suspended, created_at, updated_at)
            OUTPUT INSERTED.*
            VALUES (NEWID(), @tenant_id, @user_id, @role, GETUTCDATE(), @invited_by, 0, GETUTCDATE(), GETUTCDATE())
        `);

    // Update invitation status
    await pool.request()
        .input('invitation_id', invitation.id)
        .input('accepted_at', new Date())
        .query(`
            UPDATE invitations
            SET status = 'accepted', accepted_at = @accepted_at
            WHERE id = @invitation_id
        `);

    const membership = memberResult.recordset[0];

    logger.info('Invitation accepted', { tenantId: invitation.tenant_id, userId });

    res.json({
        success: true,
        data: {
            tenantId: membership.tenant_id,
            role: membership.role,
            joinedAt: membership.joined_at,
        },
        message: 'Successfully joined the team',
    });
}));

/**
 * @route PUT /api/v1/members/:memberId
 * @desc Update member role
 * @access Private (Admin+)
 */
router.put('/:memberId', authenticate, requireTenant, requireMinRole(Role.ADMIN), asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const { role } = req.body;
    const tenantId = req.tenantId!;
    const requesterId = req.user!.id;

    if (!role) {
        throw new ValidationError('Role is required');
    }

    // Validate role
    const validRoles = [Role.VIEWER, Role.EDITOR, Role.ADMIN];
    if (!validRoles.includes(role)) {
        throw new ValidationError('Invalid role');
    }

    // Get member details
    const memberResult = await pool.request()
        .input('member_id', memberId)
        .input('tenant_id', tenantId)
        .query('SELECT * FROM tenant_members WHERE id = @member_id AND tenant_id = @tenant_id');

    if (memberResult.recordset.length === 0) {
        throw new NotFoundError('Member not found');
    }

    const member = memberResult.recordset[0];

    // Cannot change owner role
    if (member.role === Role.OWNER) {
        throw new ForbiddenError('Cannot change owner role');
    }

    // Cannot change your own role
    if (member.user_id === requesterId) {
        throw new ForbiddenError('Cannot change your own role');
    }

    await pool.request()
        .input('member_id', memberId)
        .input('role', role)
        .query(`
            UPDATE tenant_members
            SET role = @role, updated_at = GETUTCDATE()
            WHERE id = @member_id
        `);

    logger.info('Member role updated', { tenantId, memberId, newRole: role, requesterId });

    res.json({
        success: true,
        data: {
            id: member.id,
            userId: member.user_id,
            role: role,
            message: 'Member role updated successfully',
        },
    });
}));

/**
 * @route DELETE /api/v1/members/:memberId
 * @desc Remove a member from tenant
 * @access Private (Admin+)
 */
router.delete('/:memberId', authenticate, requireTenant, requireMinRole(Role.ADMIN), asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const tenantId = req.tenantId!;
    const requesterId = req.user!.id;

    // Get member details
    const memberResult = await pool.request()
        .input('member_id', memberId)
        .input('tenant_id', tenantId)
        .query('SELECT * FROM tenant_members WHERE id = @member_id AND tenant_id = @tenant_id');

    if (memberResult.recordset.length === 0) {
        throw new NotFoundError('Member not found');
    }

    const member = memberResult.recordset[0];

    // Cannot remove owner
    if (member.role === Role.OWNER) {
        throw new ForbiddenError('Cannot remove owner');
    }

    // Cannot remove yourself
    if (member.user_id === requesterId) {
        throw new ForbiddenError('Cannot remove yourself. Use leave endpoint instead');
    }

    await pool.request()
        .input('member_id', memberId)
        .query('DELETE FROM tenant_members WHERE id = @member_id');

    logger.info('Member removed', { tenantId, memberId, requesterId });

    res.json({
        success: true,
        data: {
            message: 'Member removed successfully',
        },
    });
}));

/**
 * @route POST /api/v1/members/leave
 * @desc Leave a tenant
 * @access Private
 */
router.post('/leave', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    // Get membership
    const memberResult = await pool.request()
        .input('tenant_id', tenantId)
        .input('user_id', userId)
        .query('SELECT * FROM tenant_members WHERE tenant_id = @tenant_id AND user_id = @user_id');

    if (memberResult.recordset.length === 0) {
        throw new NotFoundError('Membership not found');
    }

    const member = memberResult.recordset[0];

    // Cannot leave if owner
    if (member.role === Role.OWNER) {
        throw new ForbiddenError('Owner cannot leave. Transfer ownership or delete the tenant instead');
    }

    await pool.request()
        .input('member_id', member.id)
        .query('DELETE FROM tenant_members WHERE id = @member_id');

    logger.info('Member left tenant', { tenantId, userId });

    res.json({
        success: true,
        data: {
            message: 'Successfully left the team',
        },
    });
}));

export default router;
