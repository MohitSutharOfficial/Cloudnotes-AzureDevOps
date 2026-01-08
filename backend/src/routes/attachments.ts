import { Router, Request, Response } from 'express';
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';
import multer from 'multer';
import crypto from 'crypto';
import { pool } from '../config/database';
import {
    authenticate,
    requireTenant,
    requireMinRole,
    asyncHandler,
    ValidationError,
    NotFoundError,
} from '../middleware';
import { Role } from '../types';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
});

// Azure Blob Storage configuration
const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT || '';
const STORAGE_KEY = process.env.AZURE_STORAGE_KEY || '';
const CONTAINER_NAME = 'attachments';

let blobServiceClient: BlobServiceClient | null = null;

if (STORAGE_ACCOUNT && STORAGE_KEY) {
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${STORAGE_ACCOUNT};AccountKey=${STORAGE_KEY};EndpointSuffix=core.windows.net`;
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
}

/**
 * Generate a SAS URL for blob access
 */
const generateSasUrl = (blobName: string): string => {
    if (!blobServiceClient || !STORAGE_ACCOUNT || !STORAGE_KEY) {
        throw new Error('Azure Storage not configured');
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blobClient = containerClient.getBlobClient(blobName);

    const sasToken = generateBlobSASQueryParameters(
        {
            containerName: CONTAINER_NAME,
            blobName: blobName,
            permissions: BlobSASPermissions.parse('r'), // read only
            startsOn: new Date(),
            expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
        sharedKeyCredential
    ).toString();

    return `${blobClient.url}?${sasToken}`;
};

/**
 * @route POST /api/v1/attachments
 * @desc Upload an attachment
 * @access Private (Editor+)
 */
router.post('/', authenticate, requireTenant, requireMinRole(Role.EDITOR), upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    const { noteId } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    if (!file) {
        throw new ValidationError('File is required');
    }

    if (!noteId) {
        throw new ValidationError('Note ID is required');
    }

    // Verify note exists and belongs to tenant
    const noteCheck = await pool.request()
        .input('note_id', noteId)
        .input('tenant_id', tenantId)
        .query('SELECT id FROM notes WHERE id = @note_id AND tenant_id = @tenant_id AND is_deleted = 0');

    if (noteCheck.recordset.length === 0) {
        throw new NotFoundError('Note not found');
    }

    // Upload to Azure Blob Storage
    if (!blobServiceClient) {
        throw new Error('Azure Storage not configured');
    }

    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

    // Generate unique blob name
    const fileExtension = file.originalname.split('.').pop();
    const blobName = `${tenantId}/${noteId}/${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload file
    await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
            blobContentType: file.mimetype,
        },
    });

    const blobUrl = blockBlobClient.url;

    // Save attachment record
    const result = await pool.request()
        .input('note_id', noteId)
        .input('file_name', file.originalname)
        .input('file_size', file.size)
        .input('mime_type', file.mimetype)
        .input('blob_url', blobUrl)
        .input('blob_name', blobName)
        .input('uploaded_by', userId)
        .query(`
            INSERT INTO attachments (id, note_id, file_name, file_size, mime_type, blob_url, blob_name, uploaded_by, created_at, is_deleted)
            OUTPUT INSERTED.*
            VALUES (NEWID(), @note_id, @file_name, @file_size, @mime_type, @blob_url, @blob_name, @uploaded_by, GETUTCDATE(), 0)
        `);

    const attachment = result.recordset[0];

    logger.info('Attachment uploaded', {
        attachmentId: attachment.id,
        noteId,
        tenantId,
        userId,
        fileName: file.originalname,
        fileSize: file.size
    });

    res.status(201).json({
        success: true,
        data: {
            id: attachment.id,
            noteId: attachment.note_id,
            fileName: attachment.file_name,
            fileSize: attachment.file_size,
            mimeType: attachment.mime_type,
            uploadedBy: attachment.uploaded_by,
            createdAt: attachment.created_at,
            downloadUrl: generateSasUrl(blobName),
        },
    });
}));

/**
 * @route GET /api/v1/attachments/:attachmentId
 * @desc Get attachment details with download URL
 * @access Private (Viewer+)
 */
router.get('/:attachmentId', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { attachmentId } = req.params;
    const tenantId = req.tenantId!;

    // Get attachment and verify tenant access
    const result = await pool.request()
        .input('attachment_id', attachmentId)
        .query(`
            SELECT a.*, n.tenant_id
            FROM attachments a
            INNER JOIN notes n ON a.note_id = n.id
            WHERE a.id = @attachment_id AND a.is_deleted = 0
        `);

    if (result.recordset.length === 0) {
        throw new NotFoundError('Attachment not found');
    }

    const attachment = result.recordset[0];

    if (attachment.tenant_id !== tenantId) {
        throw new NotFoundError('Attachment not found');
    }

    res.json({
        success: true,
        data: {
            id: attachment.id,
            noteId: attachment.note_id,
            fileName: attachment.file_name,
            fileSize: attachment.file_size,
            mimeType: attachment.mime_type,
            uploadedBy: attachment.uploaded_by,
            createdAt: attachment.created_at,
            downloadUrl: generateSasUrl(attachment.blob_name),
        },
    });
}));

/**
 * @route GET /api/v1/attachments
 * @desc Get all attachments for a note
 * @access Private (Viewer+)
 */
router.get('/', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.query;
    const tenantId = req.tenantId!;

    if (!noteId) {
        throw new ValidationError('Note ID is required');
    }

    // Verify note belongs to tenant
    const noteCheck = await pool.request()
        .input('note_id', noteId as string)
        .input('tenant_id', tenantId)
        .query('SELECT id FROM notes WHERE id = @note_id AND tenant_id = @tenant_id');

    if (noteCheck.recordset.length === 0) {
        throw new NotFoundError('Note not found');
    }

    const result = await pool.request()
        .input('note_id', noteId as string)
        .query(`
            SELECT a.*, u.name as uploader_name
            FROM attachments a
            LEFT JOIN users u ON a.uploaded_by = u.id
            WHERE a.note_id = @note_id AND a.is_deleted = 0
            ORDER BY a.created_at DESC
        `);

    const attachments = result.recordset.map(attachment => ({
        id: attachment.id,
        noteId: attachment.note_id,
        fileName: attachment.file_name,
        fileSize: attachment.file_size,
        mimeType: attachment.mime_type,
        uploadedBy: attachment.uploaded_by,
        uploaderName: attachment.uploader_name,
        createdAt: attachment.created_at,
        downloadUrl: generateSasUrl(attachment.blob_name),
    }));

    res.json({
        success: true,
        data: attachments,
    });
}));

/**
 * @route DELETE /api/v1/attachments/:attachmentId
 * @desc Delete an attachment
 * @access Private (Editor+)
 */
router.delete('/:attachmentId', authenticate, requireTenant, requireMinRole(Role.EDITOR), asyncHandler(async (req: Request, res: Response) => {
    const { attachmentId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    // Get attachment and verify tenant access
    const result = await pool.request()
        .input('attachment_id', attachmentId)
        .query(`
            SELECT a.*, n.tenant_id
            FROM attachments a
            INNER JOIN notes n ON a.note_id = n.id
            WHERE a.id = @attachment_id AND a.is_deleted = 0
        `);

    if (result.recordset.length === 0) {
        throw new NotFoundError('Attachment not found');
    }

    const attachment = result.recordset[0];

    if (attachment.tenant_id !== tenantId) {
        throw new NotFoundError('Attachment not found');
    }

    // Delete from Azure Blob Storage
    if (blobServiceClient) {
        try {
            const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
            const blockBlobClient = containerClient.getBlockBlobClient(attachment.blob_name);
            await blockBlobClient.delete();
        } catch (error) {
            logger.error('Failed to delete blob', {
                error,
                blobName: attachment.blob_name,
                attachmentId
            });
            // Continue with soft delete even if blob deletion fails
        }
    }

    // Soft delete in database
    await pool.request()
        .input('attachment_id', attachmentId)
        .input('deleted_by', userId)
        .query(`
            UPDATE attachments
            SET is_deleted = 1, deleted_by = @deleted_by, deleted_at = GETUTCDATE()
            WHERE id = @attachment_id
        `);

    logger.info('Attachment deleted', { attachmentId, tenantId, userId });

    res.json({
        success: true,
        data: {
            message: 'Attachment deleted successfully',
        },
    });
}));

export default router;
