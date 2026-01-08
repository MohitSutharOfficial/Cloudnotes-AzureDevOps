import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { config } from './index';
import { logger } from '../utils/logger';

let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

/**
 * Initialize Azure Blob Storage
 */
export const initializeBlobStorage = async (): Promise<void> => {
    try {
        if (!config.azureStorage.accountName || !config.azureStorage.accountKey) {
            logger.warn('Azure Storage credentials not configured. File uploads will be disabled.');
            return;
        }

        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${config.azureStorage.accountName};AccountKey=${config.azureStorage.accountKey};EndpointSuffix=core.windows.net`;

        blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        containerClient = blobServiceClient.getContainerClient(config.azureStorage.containerName);

        // Create container if it doesn't exist (no public access)
        await containerClient.createIfNotExists();

        logger.info('Blob storage initialized successfully', {
            container: config.azureStorage.containerName,
        });
    } catch (error) {
        logger.error('Blob storage initialization failed', { error });
        // Don't throw - allow app to start without blob storage
    }
};

/**
 * Get container client for file operations
 */
export const getContainerClient = (): ContainerClient | null => {
    return containerClient;
};

/**
 * Check blob storage connectivity
 */
export const checkBlobStorageHealth = async (): Promise<boolean> => {
    try {
        if (!containerClient) {
            return false;
        }
        await containerClient.exists();
        return true;
    } catch (error) {
        logger.error('Blob storage health check failed', { error });
        return false;
    }
};

/**
 * Upload file to blob storage
 */
export const uploadBlob = async (
    blobName: string,
    content: Buffer,
    contentType?: string
): Promise<string | null> => {
    try {
        if (!containerClient) {
            throw new Error('Blob storage not initialized');
        }

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(content, {
            blobHTTPHeaders: {
                blobContentType: contentType,
            },
        });

        return blockBlobClient.url;
    } catch (error) {
        logger.error('Failed to upload blob', { error, blobName });
        return null;
    }
};

/**
 * Delete blob from storage
 */
export const deleteBlob = async (blobName: string): Promise<boolean> => {
    try {
        if (!containerClient) {
            throw new Error('Blob storage not initialized');
        }

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.deleteIfExists();
        return true;
    } catch (error) {
        logger.error('Failed to delete blob', { error, blobName });
        return false;
    }
};

/**
 * Generate SAS URL for temporary access
 */
export const generateSasUrl = async (
    blobName: string,
    expiresInMinutes: number = 60
): Promise<string | null> => {
    try {
        if (!containerClient) {
            throw new Error('Blob storage not initialized');
        }

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        // For production, implement SAS token generation
        // For now, return the blob URL
        return blockBlobClient.url;
    } catch (error) {
        logger.error('Failed to generate SAS URL', { error, blobName });
        return null;
    }
};

export default {
    initializeBlobStorage,
    getContainerClient,
    checkBlobStorageHealth,
    uploadBlob,
    deleteBlob,
    generateSasUrl,
};
