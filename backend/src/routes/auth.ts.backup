import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
    authenticate,
    asyncHandler,
    ValidationError,
    generateToken,
    generateRefreshToken
} from '../middleware';
import { User, Role } from '../types';

const router = Router();

// In-memory user store for development
// Replace with actual database in production
const users = new Map<string, User & { passwordHash?: string }>();

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
        throw new ValidationError('Email, password, and name are required');
    }

    if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters');
    }

    // Check if user exists
    const existingUser = Array.from(users.values()).find(u => u.email === email);
    if (existingUser) {
        throw new ValidationError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user: User & { passwordHash: string } = {
        id: uuidv4(),
        email: email.toLowerCase(),
        name,
        passwordHash,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    users.set(user.id, user);

    // Generate tokens
    const accessToken = generateToken({
        id: user.id,
        email: user.email,
        name: user.name
    });
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified,
            },
            accessToken,
            refreshToken,
        },
    });
}));

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ValidationError('Email and password are required');
    }

    // Find user
    const user = Array.from(users.values()).find(u => u.email === email.toLowerCase());
    if (!user || !user.passwordHash) {
        throw new ValidationError('Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        throw new ValidationError('Invalid email or password');
    }

    // Update last login
    user.lastLoginAt = new Date();

    // Generate tokens
    const accessToken = generateToken({
        id: user.id,
        email: user.email,
        name: user.name
    });
    const refreshToken = generateRefreshToken(user.id);

    res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified,
                avatarUrl: user.avatarUrl,
            },
            accessToken,
            refreshToken,
        },
    });
}));

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new ValidationError('Refresh token is required');
    }

    // TODO: Validate refresh token from database
    // For now, we just generate a new access token

    res.json({
        success: true,
        data: {
            message: 'Token refresh not fully implemented in development mode',
        },
    });
}));

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const user = users.get(req.user!.id);

    if (!user) {
        res.status(404).json({
            success: false,
            error: {
                code: 'USER_NOT_FOUND',
                message: 'User not found',
            },
        });
        return;
    }

    res.json({
        success: true,
        data: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
        },
    });
}));

/**
 * @route PUT /api/v1/auth/me
 * @desc Update current user profile
 * @access Private
 */
router.put('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { name, avatarUrl } = req.body;
    const user = users.get(req.user!.id);

    if (!user) {
        res.status(404).json({
            success: false,
            error: {
                code: 'USER_NOT_FOUND',
                message: 'User not found',
            },
        });
        return;
    }

    if (name) user.name = name;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    user.updatedAt = new Date();

    res.json({
        success: true,
        data: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
        },
    });
}));

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user (invalidate tokens)
 * @access Private
 */
router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
    // TODO: Invalidate refresh token in database

    res.json({
        success: true,
        data: {
            message: 'Logged out successfully',
        },
    });
}));

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        throw new ValidationError('Email is required');
    }

    // TODO: Send password reset email

    res.json({
        success: true,
        data: {
            message: 'If an account exists with this email, a password reset link will be sent',
        },
    });
}));

export default router;
