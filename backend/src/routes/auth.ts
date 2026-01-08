import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/database';
import {
    authenticate,
    asyncHandler,
    ValidationError,
    UnauthorizedError,
    generateToken,
    generateRefreshToken
} from '../middleware';
import { logger } from '../utils/logger';

const router = Router();

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

    const emailLower = email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await pool.request()
        .input('email', emailLower)
        .query('SELECT id FROM users WHERE email = @email');

    if (existingUser.recordset.length > 0) {
        throw new ValidationError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const result = await pool.request()
        .input('email', emailLower)
        .input('name', name)
        .input('password_hash', passwordHash)
        .input('email_verified', false)
        .query(`
            INSERT INTO users (id, email, name, password_hash, email_verified, created_at, updated_at)
            OUTPUT INSERTED.*
            VALUES (NEWID(), @email, @name, @password_hash, @email_verified, GETUTCDATE(), GETUTCDATE())
        `);

    const user = result.recordset[0];

    logger.info('User registered', { userId: user.id, email: user.email });

    // TODO: Send verification email with verificationToken
    // For now, we'll just log it
    logger.info('Email verification token (implement email sending)', {
        userId: user.id,
        token: verificationToken
    });

    // Generate tokens
    const accessToken = generateToken({
        id: user.id,
        email: user.email,
        name: user.name
    });
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await pool.request()
        .input('user_id', user.id)
        .input('token_hash', refreshTokenHash)
        .input('expires_at', expiresAt)
        .query(`
            INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
            VALUES (NEWID(), @user_id, @token_hash, @expires_at, GETUTCDATE())
        `);

    res.status(201).json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.email_verified,
            },
            accessToken,
            refreshToken,
        },
        message: 'Registration successful. Please check your email to verify your account.'
    });
}));

/**
 * @route POST /api/v1/auth/verify-email
 * @desc Verify user email with token
 * @access Public
 */
router.post('/verify-email', asyncHandler(async (req: Request, res: Response) => {
    const { token, email } = req.body;

    if (!token || !email) {
        throw new ValidationError('Token and email are required');
    }

    // TODO: Implement actual token verification
    // For now, we'll just mark the email as verified
    const result = await pool.request()
        .input('email', email.toLowerCase())
        .query(`
            UPDATE users
            SET email_verified = 1, updated_at = GETUTCDATE()
            WHERE email = @email
        `);

    if (result.rowsAffected[0] === 0) {
        throw new ValidationError('Invalid verification token or email');
    }

    logger.info('Email verified', { email });

    res.json({
        success: true,
        data: {
            message: 'Email verified successfully',
        },
    });
}));

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Private
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ValidationError('Email and password are required');
    }

    // Find user
    const result = await pool.request()
        .input('email', email.toLowerCase())
        .query('SELECT * FROM users WHERE email = @email');

    const user = result.recordset[0];

    if (!user || !user.password_hash) {
        throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login
    await pool.request()
        .input('user_id', user.id)
        .query('UPDATE users SET last_login_at = GETUTCDATE() WHERE id = @user_id');

    logger.info('User logged in', { userId: user.id, email: user.email });

    // Generate tokens
    const accessToken = generateToken({
        id: user.id,
        email: user.email,
        name: user.name
    });
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.request()
        .input('user_id', user.id)
        .input('token_hash', refreshTokenHash)
        .input('expires_at', expiresAt)
        .query(`
            INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
            VALUES (NEWID(), @user_id, @token_hash, @expires_at, GETUTCDATE())
        `);

    res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.email_verified,
                avatarUrl: user.avatar_url,
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

    // Verify refresh token exists and is not expired
    const tokens = await pool.request()
        .query(`
            SELECT rt.*, u.id as user_id, u.email, u.name
            FROM refresh_tokens rt
            JOIN users u ON rt.user_id = u.id
            WHERE rt.expires_at > GETUTCDATE() AND rt.revoked_at IS NULL
        `);

    let validToken = null;
    for (const token of tokens.recordset) {
        const isValid = await bcrypt.compare(refreshToken, token.token_hash);
        if (isValid) {
            validToken = token;
            break;
        }
    }

    if (!validToken) {
        throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Generate new access token
    const accessToken = generateToken({
        id: validToken.user_id,
        email: validToken.email,
        name: validToken.name
    });

    res.json({
        success: true,
        data: {
            accessToken,
        },
    });
}));

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const result = await pool.request()
        .input('user_id', req.user!.id)
        .query('SELECT id, email, name, avatar_url, email_verified, created_at FROM users WHERE id = @user_id');

    const user = result.recordset[0];

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
            avatarUrl: user.avatar_url,
            emailVerified: user.email_verified,
            createdAt: user.created_at,
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

    const updates: string[] = [];
    const request = pool.request().input('user_id', req.user!.id);

    if (name) {
        updates.push('name = @name');
        request.input('name', name);
    }
    if (avatarUrl !== undefined) {
        updates.push('avatar_url = @avatar_url');
        request.input('avatar_url', avatarUrl);
    }
    updates.push('updated_at = GETUTCDATE()');

    if (updates.length === 1) {
        throw new ValidationError('No valid fields to update');
    }

    await request.query(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = @user_id
    `);

    const result = await pool.request()
        .input('user_id', req.user!.id)
        .query('SELECT id, email, name, avatar_url FROM users WHERE id = @user_id');

    const user = result.recordset[0];

    logger.info('User profile updated', { userId: user.id });

    res.json({
        success: true,
        data: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
        },
    });
}));

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user (invalidate tokens)
 * @access Private
 */
router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
        // Revoke refresh token
        const tokens = await pool.request()
            .input('user_id', req.user!.id)
            .query('SELECT * FROM refresh_tokens WHERE user_id = @user_id AND revoked_at IS NULL');

        for (const token of tokens.recordset) {
            const isValid = await bcrypt.compare(refreshToken, token.token_hash);
            if (isValid) {
                await pool.request()
                    .input('token_id', token.id)
                    .query('UPDATE refresh_tokens SET revoked_at = GETUTCDATE() WHERE id = @token_id');
                break;
            }
        }
    }

    logger.info('User logged out', { userId: req.user!.id });

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

    const user = await pool.request()
        .input('email', email.toLowerCase())
        .query('SELECT id, email FROM users WHERE email = @email');

    if (user.recordset.length > 0) {
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // TODO: Store reset token and send email
        logger.info('Password reset requested', {
            userId: user.recordset[0].id,
            token: resetToken
        });
    }

    // Always return success to prevent email enumeration
    res.json({
        success: true,
        data: {
            message: 'If an account exists with this email, a password reset link will be sent',
        },
    });
}));

export default router;
