import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    database: {
        server: process.env.DB_SERVER || process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE || process.env.DB_NAME || 'saas_db',
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || '1433', 10),
        options: {
            encrypt: process.env.DB_ENCRYPT === 'true' || process.env.NODE_ENV === 'production',
            trustServerCertificate: process.env.NODE_ENV !== 'production',
        },
    },

    // Azure AD B2C
    azureAdB2C: {
        tenantName: process.env.AZURE_AD_B2C_TENANT_NAME || '',
        clientId: process.env.AZURE_AD_B2C_CLIENT_ID || '',
        policyName: process.env.AZURE_AD_B2C_POLICY_NAME || '',
        issuer: process.env.AZURE_AD_B2C_ISSUER || '',
    },

    // Azure Storage
    azureStorage: {
        accountName: process.env.AZURE_STORAGE_ACCOUNT || process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
        accountKey: process.env.AZURE_STORAGE_KEY || process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
        containerName: process.env.AZURE_STORAGE_CONTAINER || process.env.AZURE_STORAGE_CONTAINER_NAME || 'attachments',
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret-change-me',
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-me',
        refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    },

    // CORS
    cors: {
        allowedOrigins: (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(origin => origin.trim()),
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
};

export default config;
