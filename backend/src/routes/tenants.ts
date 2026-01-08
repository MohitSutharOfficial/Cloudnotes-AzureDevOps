import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    authenticate,
    asyncHandler,
    requireOwner,
    requireAdmin,
    ValidationError,
    NotFoundError,
    ConflictError,
    generateToken
} from '../middleware';
import { Tenant, TenantStatus, Role, TenantMember } from '../types';

const router = Router();

// In-memory stores for development
const tenants = new Map<string, Tenant>();
const tenantMembers = new Map<string, TenantMember>();

/**
 * Helper: Generate URL-friendly slug
 */
const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + uuidv4().substring(0, 8);
};

/**
 * @route POST /api/v1/tenants
 * @desc Create a new tenant (organization)
 * @access Private
 */
router.post('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { name, slug } = req.body;
    const userId = req.user!.id;

    if (!name || name.trim().length < 2) {
        throw new ValidationError('Tenant name must be at least 2 characters');
    }

    // Check slug uniqueness
    const finalSlug = slug || generateSlug(name);
    const existingTenant = Array.from(tenants.values()).find(t => t.slug === finalSlug);
    if (existingTenant) {
        throw new ConflictError('A tenant with this slug already exists');
    }

    // Create tenant
    const tenant: Tenant = {
        id: uuidv4(),
        name: name.trim(),
        slug: finalSlug,
        status: TenantStatus.ACTIVE,
        ownerId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    tenants.set(tenant.id, tenant);

    // Add creator as owner
    const membership: TenantMember = {
        id: uuidv4(),
        tenantId: tenant.id,
        userId: userId,
        role: Role.OWNER,
        joinedAt: new Date(),
        invitedBy: userId,
        isSuspended: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    tenantMembers.set(membership.id, membership);

    // Generate new token with tenant context
    const newToken = generateToken(req.user!, tenant.id, Role.OWNER);

    res.status(201).json({
        success: true,
        data: {
            tenant,
            membership,
            accessToken: newToken,
        },
    });
}));

/**
 * @route GET /api/v1/tenants
 * @desc Get all tenants for current user
 * @access Private
 */
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Find user's memberships
    const userMemberships = Array.from(tenantMembers.values())
        .filter(m => m.userId === userId && !m.isSuspended);

    // Get tenant details
    const userTenants = userMemberships.map(m => {
        const tenant = tenants.get(m.tenantId);
        return {
            ...tenant,
            role: m.role,
            joinedAt: m.joinedAt,
        };
    }).filter(t => t && t.status === TenantStatus.ACTIVE);

    res.json({
        success: true,
        data: userTenants,
        meta: {
            total: userTenants.length,
        },
    });
}));

/**
 * @route GET /api/v1/tenants/:tenantId
 * @desc Get tenant details
 * @access Private (member)
 */
router.get('/:tenantId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const userId = req.user!.id;

    const tenant = tenants.get(tenantId);
    if (!tenant || tenant.status === TenantStatus.DELETED) {
        throw new NotFoundError('Tenant', tenantId);
    }

    // Check membership
    const membership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);

    if (!membership) {
        throw new NotFoundError('Tenant', tenantId);
    }

    // Count members
    const memberCount = Array.from(tenantMembers.values())
        .filter(m => m.tenantId === tenantId && !m.isSuspended).length;

    res.json({
        success: true,
        data: {
            ...tenant,
            role: membership.role,
            memberCount,
        },
    });
}));

/**
 * @route PUT /api/v1/tenants/:tenantId
 * @desc Update tenant details
 * @access Private (admin+)
 */
router.put('/:tenantId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const { name, logoUrl, settings } = req.body;
    const userId = req.user!.id;

    const tenant = tenants.get(tenantId);
    if (!tenant || tenant.status === TenantStatus.DELETED) {
        throw new NotFoundError('Tenant', tenantId);
    }

    // Check admin access
    const membership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);

    if (!membership || (membership.role !== Role.OWNER && membership.role !== Role.ADMIN)) {
        res.status(403).json({
            success: false,
            error: {
                code: 'FORBIDDEN',
                message: 'Admin access required to update tenant',
            },
        });
        return;
    }

    // Update fields
    if (name) tenant.name = name.trim();
    if (logoUrl !== undefined) tenant.logoUrl = logoUrl;
    if (settings) tenant.settings = { ...tenant.settings, ...settings };
    tenant.updatedAt = new Date();

    res.json({
        success: true,
        data: tenant,
    });
}));

/**
 * @route DELETE /api/v1/tenants/:tenantId
 * @desc Delete tenant (soft delete)
 * @access Private (owner only)
 */
router.delete('/:tenantId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const userId = req.user!.id;

    const tenant = tenants.get(tenantId);
    if (!tenant || tenant.status === TenantStatus.DELETED) {
        throw new NotFoundError('Tenant', tenantId);
    }

    // Check owner access
    if (tenant.ownerId !== userId) {
        res.status(403).json({
            success: false,
            error: {
                code: 'FORBIDDEN',
                message: 'Only the owner can delete a tenant',
            },
        });
        return;
    }

    // Soft delete
    tenant.status = TenantStatus.DELETED;
    tenant.updatedAt = new Date();

    res.json({
        success: true,
        data: {
            message: 'Tenant deleted successfully',
        },
    });
}));

/**
 * @route POST /api/v1/tenants/:tenantId/switch
 * @desc Switch to a tenant context
 * @access Private (member)
 */
router.post('/:tenantId/switch', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const userId = req.user!.id;

    const tenant = tenants.get(tenantId);
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
        throw new NotFoundError('Tenant', tenantId);
    }

    // Check membership
    const membership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);

    if (!membership) {
        res.status(403).json({
            success: false,
            error: {
                code: 'NOT_A_MEMBER',
                message: 'You are not a member of this tenant',
            },
        });
        return;
    }

    // Generate new token with tenant context
    const newToken = generateToken(req.user!, tenantId, membership.role);

    res.json({
        success: true,
        data: {
            tenant,
            role: membership.role,
            accessToken: newToken,
        },
    });
}));

// Export stores for use by other routes
export { tenants, tenantMembers };
export default router;
