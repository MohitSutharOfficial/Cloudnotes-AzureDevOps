import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import {
    errorHandler,
    notFoundHandler,
    rateLimit,
    extractTenant,
    optionalAuth
} from './middleware';
import { initializeAppInsights } from './utils/appInsights';
import { logger, logRequest } from './utils/logger';
import { initializeDatabase } from './config/database';
import { initializeBlobStorage } from './config/blobStorage';

// Import routes
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import memberRoutes from './routes/members';
import noteRoutes from './routes/notes';
import attachmentRoutes from './routes/attachments';
import healthRoutes from './routes/health';

const app = express();

// ============================================
// Security Middleware
// ============================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ============================================
// CORS Configuration
// ============================================
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        if (config.cors.allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}));

// ============================================
// Request Parsing
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Rate Limiting
// ============================================
app.use(rateLimit({
    windowMs: config.rateLimit.windowMs,
    maxRequests: config.rateLimit.maxRequests,
}));

// ============================================
// Request Logging (Development)
// ============================================
if (config.nodeEnv === 'development') {
    app.use((req, res, next) => {
        logRequest(req);
        next();
    });
}

// ============================================
// Global Middleware
// ============================================
app.use(optionalAuth);
app.use(extractTenant);

// ============================================
// API Routes
// ============================================
const apiRouter = express.Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/tenants', tenantRoutes);
apiRouter.use('/members', memberRoutes);
apiRouter.use('/notes', noteRoutes);
apiRouter.use('/attachments', attachmentRoutes);

// Mount API routes with versioning
app.use('/api/v1', apiRouter);

// Legacy route support
app.use('/api', apiRouter);

// ============================================
// Error Handling
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// Server Startup
// ============================================
const startServer = async () => {
    try {
        // Initialize Application Insights for production monitoring
        initializeAppInsights();

        // Initialize database connection
        try {
            await initializeDatabase();
            logger.info('✓ Database initialized');
        } catch (dbError) {
            logger.warn('Database initialization failed - app will run with limited functionality', { error: dbError });
            // Don't crash - allow app to start for health checks
        }

        // Initialize blob storage
        try {
            await initializeBlobStorage();
            logger.info('✓ Blob storage initialized');
        } catch (storageError) {
            logger.warn('Blob storage initialization failed - file uploads disabled', { error: storageError });
            // Don't crash - allow app to start without blob storage
        }

        app.listen(config.port, () => {
            logger.info('Server started successfully', {
                port: config.port,
                environment: config.nodeEnv,
                apiBase: `http://localhost:${config.port}/api/v1`,
            });

            console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Multi-Tenant SaaS API Server                          ║
║                                                            ║
║   Environment: ${config.nodeEnv.padEnd(42)}║
║   Port: ${config.port.toString().padEnd(49)}║
║   API Base: http://localhost:${config.port}/api/v1${' '.repeat(23)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
        });
    } catch (error) {
        logger.error('Failed to start server', { error });
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
