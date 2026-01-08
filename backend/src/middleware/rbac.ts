import { Request, Response, NextFunction } from 'express';
import { Role, RoleHierarchy, Permission, RolePermissions } from '../types';

/**
 * RBAC (Role-Based Access Control) Middleware
 * Enforces role and permission requirements on routes
 */

/**
 * Require a minimum role level
 */
export const requireRole = (...allowedRoles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;

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

        if (!user.role) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'NO_TENANT_ACCESS',
                    message: 'You must be a member of a tenant to access this resource',
                },
            });
            return;
        }

        if (!allowedRoles.includes(user.role)) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_ROLE',
                    message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
                },
            });
            return;
        }

        next();
    };
};

/**
 * Require a minimum role level (hierarchical check)
 */
export const requireMinRole = (minRole: Role) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;

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

        if (!user.role) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'NO_TENANT_ACCESS',
                    message: 'You must be a member of a tenant to access this resource',
                },
            });
            return;
        }

        const userRoleLevel = RoleHierarchy[user.role];
        const requiredRoleLevel = RoleHierarchy[minRole];

        if (userRoleLevel < requiredRoleLevel) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_ROLE',
                    message: `This action requires at least ${minRole} role`,
                },
            });
            return;
        }

        next();
    };
};

/**
 * Require specific permissions
 */
export const requirePermission = (...requiredPermissions: Permission[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;

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

        if (!user.role) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'NO_TENANT_ACCESS',
                    message: 'You must be a member of a tenant to access this resource',
                },
            });
            return;
        }

        const userPermissions = RolePermissions[user.role] || [];
        const hasAllPermissions = requiredPermissions.every(p => userPermissions.includes(p));

        if (!hasAllPermissions) {
            const missingPermissions = requiredPermissions.filter(p => !userPermissions.includes(p));
            res.status(403).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: `Missing required permissions: ${missingPermissions.join(', ')}`,
                },
            });
            return;
        }

        next();
    };
};

/**
 * Require owner role specifically
 */
export const requireOwner = requireRole(Role.OWNER);

/**
 * Require at least admin role
 */
export const requireAdmin = requireRole(Role.OWNER, Role.ADMIN);

/**
 * Require at least editor role
 */
export const requireEditor = requireRole(Role.OWNER, Role.ADMIN, Role.EDITOR);

/**
 * Check if user has a specific permission
 */
export const hasPermission = (role: Role | undefined, permission: Permission): boolean => {
    if (!role) return false;
    const permissions = RolePermissions[role] || [];
    return permissions.includes(permission);
};

/**
 * Check if user has minimum role level
 */
export const hasMinRole = (userRole: Role | undefined, minRole: Role): boolean => {
    if (!userRole) return false;
    return RoleHierarchy[userRole] >= RoleHierarchy[minRole];
};
