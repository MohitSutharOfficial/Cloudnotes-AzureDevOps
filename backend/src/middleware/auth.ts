import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedUser, Role } from '../types';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

/**
 * JWT Authentication Middleware
 * Validates JWT token and extracts user information
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'No authentication token provided',
                },
            });
            return;
        }

        const token = authHeader.substring(7);

        // For production with Azure AD B2C, you would validate against the Azure AD B2C issuer
        // For development, we use a simple JWT secret
        const decoded = jwt.verify(token, config.jwt.secret) as any;

        req.user = {
            id: decoded.sub || decoded.id,
            email: decoded.email,
            name: decoded.name,
            tenantId: decoded.tenantId,
            role: decoded.role,
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_EXPIRED',
                    message: 'Authentication token has expired',
                },
            });
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid authentication token',
                },
            });
            return;
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'AUTH_ERROR',
                message: 'Authentication failed',
            },
        });
    }
};

/**
 * Optional authentication - doesn't fail if no token present
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next();
        return;
    }

    try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwt.secret) as any;

        req.user = {
            id: decoded.sub || decoded.id,
            email: decoded.email,
            name: decoded.name,
            tenantId: decoded.tenantId,
            role: decoded.role,
        };
    } catch {
        // Ignore errors for optional auth
    }

    next();
};

/**
 * Generate JWT token for a user
 */
export const generateToken = (user: AuthenticatedUser, tenantId?: string, role?: Role): string => {
    const payload = {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: tenantId || user.tenantId,
        role: role || user.role,
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as string,
    } as jwt.SignOptions);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (userId: string): string => {
    return jwt.sign({ sub: userId, type: 'refresh' }, config.jwt.secret, {
        expiresIn: '7d',
    });
};
