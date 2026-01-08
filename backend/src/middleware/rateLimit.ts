import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter
// In production, use Redis for distributed rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    message?: string;
}

/**
 * Rate Limiting Middleware
 * Limits the number of requests per IP/user within a time window
 */
export const rateLimit = (config: RateLimitConfig) => {
    const { windowMs, maxRequests, message = 'Too many requests, please try again later' } = config;

    return (req: Request, res: Response, next: NextFunction): void => {
        // Use user ID if authenticated, otherwise use IP
        const key = req.user?.id || req.ip || 'unknown';
        const now = Date.now();

        let requestData = requestCounts.get(key);

        if (!requestData || now > requestData.resetTime) {
            requestData = {
                count: 0,
                resetTime: now + windowMs,
            };
        }

        requestData.count++;
        requestCounts.set(key, requestData);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requestData.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(requestData.resetTime / 1000));

        if (requestData.count > maxRequests) {
            res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message,
                    retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
                },
            });
            return;
        }

        next();
    };
};

/**
 * Cleanup old entries periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now > data.resetTime) {
            requestCounts.delete(key);
        }
    }
}, 60000); // Clean up every minute
