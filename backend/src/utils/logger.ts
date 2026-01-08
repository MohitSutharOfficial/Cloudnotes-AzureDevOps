import winston from 'winston';
import { config } from '../config';

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create console transport with colorization for development
const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let log = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(meta).length > 0) {
                log += ` ${JSON.stringify(meta)}`;
            }
            return log;
        })
    ),
});

// Create file transports
const fileTransports = [
    new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
    new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5,
    }),
];

// Create logger instance
export const logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: logFormat,
    defaultMeta: {
        service: 'saas-backend',
        environment: config.nodeEnv,
    },
    transports:
        config.nodeEnv === 'production'
            ? fileTransports
            : [consoleTransport],
});

// Log uncaught exceptions and unhandled rejections
logger.exceptions.handle(
    new winston.transports.File({ filename: 'logs/exceptions.log' })
);

logger.rejections.handle(
    new winston.transports.File({ filename: 'logs/rejections.log' })
);

// Helper functions for structured logging
export const logRequest = (req: any) => {
    logger.info('HTTP Request', {
        method: req.method,
        path: req.path,
        query: req.query,
        userId: req.user?.id,
        tenantId: req.tenantId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
};

export const logError = (error: Error, req?: any) => {
    logger.error('Application Error', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        method: req?.method,
        path: req?.path,
        userId: req?.user?.id,
        tenantId: req?.tenantId,
    });
};

export const logSecurityEvent = (event: string, details: any) => {
    logger.warn('Security Event', {
        event,
        ...details,
    });
};

export default logger;
