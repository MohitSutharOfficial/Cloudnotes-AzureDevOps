import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database';
import { checkBlobStorageHealth } from '../config/blobStorage';

const router = Router();

/**
 * @route GET /api/v1/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/', (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
        },
    });
});

/**
 * @route GET /api/v1/health/ready
 * @desc Readiness check (includes dependency checks)
 * @access Public
 */
router.get('/ready', async (req: Request, res: Response) => {
    const checks = {
        database: false,
        storage: false,
    };

    try {
        // Check database connectivity
        checks.database = await checkDatabaseHealth();

        // Check blob storage connectivity
        checks.storage = await checkBlobStorageHealth();

        const allHealthy = checks.database && checks.storage;

        res.status(allHealthy ? 200 : 503).json({
            success: allHealthy,
            data: {
                status: allHealthy ? 'ready' : 'degraded',
                checks,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            data: {
                status: 'not_ready',
                checks,
                timestamp: new Date().toISOString(),
            },
        });
    }
});

/**
 * @route GET /api/v1/health/live
 * @desc Liveness check (simple alive check)
 * @access Public
 */
router.get('/live', (req: Request, res: Response) => {
    res.status(200).send('OK');
});

export default router;
