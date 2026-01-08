import sql from 'mssql';
import { config } from './index';
import { logger } from '../utils/logger';

/**
 * Database Configuration for Azure SQL / SQL Server
 */
const dbConfig: sql.config = {
    server: config.database.host,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    port: config.database.port,
    options: {
        encrypt: true, // Required for Azure SQL
        enableArithAbort: true,
        trustServerCertificate: config.nodeEnv === 'development', // Only for local dev
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
    connectionTimeout: 30000,
    requestTimeout: 30000,
};

// Create connection pool
export const pool = new sql.ConnectionPool(dbConfig);

let isConnected = false;

/**
 * Initialize database connection
 */
export const initializeDatabase = async (): Promise<void> => {
    try {
        if (!isConnected) {
            await pool.connect();
            isConnected = true;
            logger.info('Database connected successfully', {
                server: config.database.host,
                database: config.database.name,
            });
        }
    } catch (error) {
        logger.error('Database connection failed', { error });
        throw error;
    }
};

/**
 * Check database connectivity
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
    try {
        if (!isConnected) {
            await initializeDatabase();
        }
        const result = await pool.request().query('SELECT 1 as health');
        return result.recordset.length > 0;
    } catch (error) {
        logger.error('Database health check failed', { error });
        return false;
    }
};

/**
 * Close database connection (for graceful shutdown)
 */
export const closeDatabaseConnection = async (): Promise<void> => {
    try {
        if (isConnected) {
            await pool.close();
            isConnected = false;
            logger.info('Database connection closed');
        }
    } catch (error) {
        logger.error('Error closing database connection', { error });
    }
};

// Handle process termination
process.on('SIGINT', async () => {
    await closeDatabaseConnection();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeDatabaseConnection();
    process.exit(0);
});

export default pool;
