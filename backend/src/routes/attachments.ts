import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import {
    authenticate,
    asyncHandler,
    requireTenant,
    ValidationError,
    NotFoundError,
    ForbiddenError
} from '../middleware';
import { Attachment, Role } from '../types';
import { tenantMembers } from './tenants';
import { notes } from './notes';

const router = Router();

// In-memory attachments store
const attachments = new Map<string, Attachment>();

// Multer configuration for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Allowed file types
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        'application/json',
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5, // Max 5 files at once
    },
});

/**
 * Helper: Check tenant access
 */
const checkTenantAccess = (tenantId: string, userId: string): { role: Role } | null => {
    const membership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);
    return membership ? { role: membership.role } : null;
};

/**
 * @route GET /api/v1/attachments
 * @desc Get all attachments for a note
 * @access Private (viewer+)
 */
router.get('/', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.query;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access) {
        throw new ForbiddenError('You do not have access to this tenant');
    }

    let filteredAttachments = Array.from(attachments.values())
        .filter(a => a.tenantId === tenantId && !a.isDeleted);

    if (noteId) {
        filteredAttachments = filteredAttachments.filter(a => a.noteId === noteId);
    }

    res.json({
        success: true,
        data: filteredAttachments,
        meta: {
            total: filteredAttachments.length,
        },
    });
}));

/**
 * @route POST /api/v1/attachments
 * @desc Upload attachments to a note
 * @access Private (editor+)
 */
router.post('/', authenticate, requireTenant, upload.array('files', 5), asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    if (!noteId) {
        throw new ValidationError('Note ID is required');
    }

    const access = checkTenantAccess(tenantId, userId);
    if (!access) {
        throw new ForbiddenError('You do not have access to this tenant');
    }

    if (access.role === Role.VIEWER) {
        throw new ForbiddenError('Viewers cannot upload files');
    }

    // Verify note exists and belongs to tenant
    const note = notes.get(noteId);
    if (!note || note.tenantId !== tenantId || note.isDeleted) {
        throw new NotFoundError('Note', noteId);
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
        throw new ValidationError('At least one file is required');
    }

    const uploadedAttachments: Attachment[] = [];

    for (const file of files) {
        // Generate unique filename
        const ext = path.extname(file.originalname);
        const fileName = `${tenantId}/${noteId}/${uuidv4()}${ext}`;

        // In production, upload to Azure Blob Storage
        // const blobUrl = await uploadToAzureBlob(file.buffer, fileName, file.mimetype);

        // For development, we'll just store metadata
        const blobUrl = `https://storage.example.com/${fileName}`;

        const attachment: Attachment = {
            id: uuidv4(),
            tenantId,
            noteId,
            fileName,
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            blobUrl,
            uploadedBy: userId,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        attachments.set(attachment.id, attachment);
        uploadedAttachments.push(attachment);
    }

    res.status(201).json({
        success: true,
        data: uploadedAttachments,
    });
}));

/**
 * @route GET /api/v1/attachments/:attachmentId
 * @desc Get attachment details/download URL
 * @access Private (viewer+)
 */
router.get('/:attachmentId', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { attachmentId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access) {
        throw new ForbiddenError('You do not have access to this tenant');
    }

    const attachment = attachments.get(attachmentId);
    if (!attachment || attachment.tenantId !== tenantId || attachment.isDeleted) {
        throw new NotFoundError('Attachment', attachmentId);
    }

    // In production, generate a time-limited SAS URL for secure download
    // const downloadUrl = await generateSasUrl(attachment.blobUrl, 3600);
    const downloadUrl = attachment.blobUrl + '?token=example-sas-token';

    res.json({
        success: true,
        data: {
            ...attachment,
            downloadUrl,
            expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
        },
    });
}));

/**
 * @route DELETE /api/v1/attachments/:attachmentId
 * @desc Delete an attachment
 * @access Private (editor+ for own uploads, admin+ for any)
 */
router.delete('/:attachmentId', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { attachmentId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access) {
        throw new ForbiddenError('You do not have access to this tenant');
    }

    const attachment = attachments.get(attachmentId);
    if (!attachment || attachment.tenantId !== tenantId) {
        throw new NotFoundError('Attachment', attachmentId);
    }

    const isUploader = attachment.uploadedBy === userId;
    const isAdmin = access.role === Role.OWNER || access.role === Role.ADMIN;
    const canEdit = access.role !== Role.VIEWER;

    if (!canEdit) {
        throw new ForbiddenError('Viewers cannot delete attachments');
    }

    if (!isUploader && !isAdmin) {
        throw new ForbiddenError('You can only delete attachments you uploaded');
    }

    // Soft delete
    attachment.isDeleted = true;
    attachment.updatedAt = new Date();

    // In production, also delete from Azure Blob Storage (or mark for cleanup)
    // await deleteFromAzureBlob(attachment.blobUrl);

    res.json({
        success: true,
        data: {
            message: 'Attachment deleted successfully',
        },
    });
}));

export default router;
