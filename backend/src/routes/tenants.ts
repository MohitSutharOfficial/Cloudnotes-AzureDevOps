import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../config/database';
import {
    authenticate,
    asyncHandler,
    requireOwner,
    requireAdmin,
    requireMinRole,
    ValidationError,
    NotFoundError,
    ConflictError,
    generateToken
} from '../middleware';
import { TenantStatus, Role } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Helper: Generate URL-friendly slug
 */
const generateSlug = (name: string): string => {
    const base = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const random = crypto.randomBytes(4).toString('hex');
    return `${base}-${random}`;
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

    const existingTenant = await pool.request()
        .input('slug', finalSlug)
        .query('SELECT id FROM tenants WHERE slug = @slug');

    if (existingTenant.recordset.length > 0) {
        throw new ConflictError('A tenant with this slug already exists');
    }

    // Create tenant
    const tenantResult = await pool.request()
        .input('name', name.trim())
        .input('slug', finalSlug)
        .input('status', TenantStatus.ACTIVE)
        .input('owner_id', userId)
        .query(`
            INSERT INTO tenants (id, name, slug, status, owner_id, created_at, updated_at)
            OUTPUT INSERTED.*
            VALUES (NEWID(), @name, @slug, @status, @owner_id, GETUTCDATE(), GETUTCDATE())
        `);

    const tenant = tenantResult.recordset[0];

    // Add creator as owner
    const membershipResult = await pool.request()
        .input('tenant_id', tenant.id)
        .input('user_id', userId)
        .input('role', Role.OWNER)
        .input('invited_by', userId)
        .query(`
            INSERT INTO tenant_members (id, tenant_id, user_id, role, joined_at, invited_by, is_suspended, created_at, updated_at)
            OUTPUT INSERTED.*
            VALUES (NEWID(), @tenant_id, @user_id, @role, GETUTCDATE(), @invited_by, 0, GETUTCDATE(), GETUTCDATE())
        `);

    const membership = membershipResult.recordset[0];

    logger.info('Tenant created', { tenantId: tenant.id, userId, name: tenant.name });

    // Generate new token with tenant context
    const newToken = generateToken(req.user!, tenant.id, Role.OWNER);

    res.status(201).json({
        success: true,
        data: {
            tenant: {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                status: tenant.status,
                ownerId: tenant.owner_id,
                createdAt: tenant.created_at,
                updatedAt: tenant.updated_at,
            },
            membership: {
                id: membership.id,
                tenantId: membership.tenant_id,
                userId: membership.user_id,
                role: membership.role,
                joinedAt: membership.joined_at,
            },
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

    const result = await pool.request()
        .input('user_id', userId)
        .query(`
            SELECT 
                t.id, t.name, t.slug, t.status, t.owner_id, t.created_at, t.updated_at,
                tm.role, tm.joined_at, tm.is_suspended
            FROM tenants t
            INNER JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = @user_id AND tm.is_suspended = 0
            ORDER BY t.created_at DESC
        `);

    const tenants = result.recordset.map(row => ({
        tenant: {
            id: row.id,
            name: row.name,
            slug: row.slug,
            status: row.status,
            ownerId: row.owner_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        },
        role: row.role,
        joinedAt: row.joined_at,
        isSuspended: row.is_suspended,
    }));

    res.json({
        success: true,
        data: tenants,
    });
}));

/**
 * @route GET /api/v1/tenants/:tenantId
 * @desc Get tenant details
 * @access Private (Member)
 */
router.get('/:tenantId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const userId = req.user!.id;

    // Verify user is a member
    const membershipCheck = await pool.request()
        .input('tenant_id', tenantId)
        .input('user_id', userId)
        .query('SELECT id FROM tenant_members WHERE tenant_id = @tenant_id AND user_id = @user_id AND is_suspended = 0');

    if (membershipCheck.recordset.length === 0) {
        throw new NotFoundError('Tenant not found or access denied');
    }

    const result = await pool.request()
        .input('tenant_id', tenantId)
        .query('SELECT * FROM tenants WHERE id = @tenant_id');

    const tenant = result.recordset[0];

    if (!tenant) {
        throw new NotFoundError('Tenant not found');
    }

    res.json({
        success: true,
        data: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            ownerId: tenant.owner_id,
            settings: tenant.settings,
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
        },
    });
}));

/**
 * @route PUT /api/v1/tenants/:tenantId
 * @desc Update tenant details
 * @access Private (Admin+)
 */
router.put('/:tenantId', authenticate, requireMinRole(Role.ADMIN), asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const { name, settings } = req.body;

    const updates: string[] = [];
    const request = pool.request().input('tenant_id', tenantId);

    if (name) {
        if (name.trim().length < 2) {
            throw new ValidationError('Tenant name must be at least 2 characters');
        }
        updates.push('name = @name');
        request.input('name', name.trim());
    }

    if (settings) {
        updates.push('settings = @settings');
        request.input('settings', JSON.stringify(settings));
    }

    if (updates.length === 0) {
        throw new ValidationError('No valid fields to update');
    }

    updates.push('updated_at = GETUTCDATE()');

    await request.query(`
        UPDATE tenants
        SET ${updates.join(', ')}
        WHERE id = @tenant_id
    `);

    const result = await pool.request()
        .input('tenant_id', tenantId)
        .query('SELECT * FROM tenants WHERE id = @tenant_id');

    const tenant = result.recordset[0];

    logger.info('Tenant updated', { tenantId, userId: req.user!.id });

    res.json({
        success: true,
        data: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            ownerId: tenant.owner_id,
            settings: tenant.settings,
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
        },
    });
}));

/**
 * @route DELETE /api/v1/tenants/:tenantId
 * @desc Delete tenant (owner only)
 * @access Private (Owner)
 */
router.delete('/:tenantId', authenticate, requireOwner, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.params;

    // Delete all related data (cascade will handle most)
    await pool.request()
        .input('tenant_id', tenantId)
        .query('DELETE FROM tenants WHERE id = @tenant_id');

    logger.info('Tenant deleted', { tenantId, userId: req.user!.id });

    res.json({
        success: true,
        data: {
            message: 'Tenant deleted successfully',
        },
    });
}));

/**
 * @route POST /api/v1/tenants/:tenantId/switch
 * @desc Switch active tenant context
 * @access Private (Member)
 */
router.post('/:tenantId/switch', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const userId = req.user!.id;

    // Verify membership
    const result = await pool.request()
        .input('tenant_id', tenantId)
        .input('user_id', userId)
        .query('SELECT role FROM tenant_members WHERE tenant_id = @tenant_id AND user_id = @user_id AND is_suspended = 0');

    if (result.recordset.length === 0) {
        throw new NotFoundError('Tenant not found or access denied');
    }

    const membership = result.recordset[0];

    // Generate new token with tenant context
    const newToken = generateToken(req.user!, tenantId, membership.role);

    res.json({
        success: true,
        data: {
            accessToken: newToken,
            tenantId,
            role: membership.role,
        },
    });
}));

export default router;
