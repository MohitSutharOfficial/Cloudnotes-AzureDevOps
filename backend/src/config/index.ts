import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    database: {
        host: process.env.DB_HOST || 'localhost',
        name: process.env.DB_NAME || 'saas_db',
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || '1433', 10),
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
        accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
        accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
        containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'attachments',
    },

    // JWT (for development)
    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret-change-me',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },

    // CORS
    cors: {
        allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
};

export default config;
