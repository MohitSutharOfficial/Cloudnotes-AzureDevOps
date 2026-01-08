import { Request, Response, NextFunction } from 'express';
// Note: In production, you'd use a database query to validate tenant membership
// This is a placeholder that would be replaced with actual DB calls

/**
 * Tenant Context Middleware
 * Ensures requests are scoped to the correct tenant
 */

/**
 * Extract and validate tenant from request
 * Tenant can be specified via:
 * 1. X-Tenant-ID header
 * 2. URL parameter (:tenantId)
 * 3. User's current tenant (from JWT)
 */
export const extractTenant = (req: Request, res: Response, next: NextFunction): void => {
    // Priority: URL param > Header > JWT claim
    const tenantId =
        req.params.tenantId ||
        req.headers['x-tenant-id'] as string ||
        req.user?.tenantId;

    if (tenantId) {
        // Set tenantId on request for downstream use
        req.tenantId = tenantId;
    }

    next();
};

/**
 * Require a valid tenant context
 */
export const requireTenant = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenantId) {
        res.status(400).json({
            success: false,
            error: {
                code: 'TENANT_REQUIRED',
                message: 'A valid tenant context is required for this operation',
            },
        });
        return;
    }

    next();
};

/**
 * Validate that user is a member of the specified tenant
 * This would typically involve a database query
 */
export const validateTenantMembership = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const user = req.user;
    const tenantId = req.tenantId;

    if (!user) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
            },
        });
        return;
    }

    if (!tenantId) {
        res.status(400).json({
            success: false,
            error: {
                code: 'TENANT_REQUIRED',
                message: 'Tenant context is required',
            },
        });
        return;
    }

    // TODO: Replace with actual database query
    // const membership = await TenantMemberService.getMembership(user.id, tenantId);
    // if (!membership || membership.isSuspended) {
    //   res.status(403).json({
    //     success: false,
    //     error: {
    //       code: 'TENANT_ACCESS_DENIED',
    //       message: 'You do not have access to this tenant',
    //     },
    //   });
    //   return;
    // }
    // req.user.role = membership.role;

    next();
};

// Extend Express Request type for tenant
declare global {
    namespace Express {
        interface Request {
            tenantId?: string;
        }
    }
}
