import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    authenticate,
    asyncHandler,
    requireTenant,
    requireEditor,
    requirePermission,
    ValidationError,
    NotFoundError,
    ForbiddenError
} from '../middleware';
import { Note, Role, Permission } from '../types';
import { tenantMembers } from './tenants';

const router = Router();

// In-memory notes store
const notes = new Map<string, Note>();

/**
 * Helper: Check if user has access to tenant
 */
const checkTenantAccess = (tenantId: string, userId: string): { role: Role } | null => {
    const membership = Array.from(tenantMembers.values())
        .find(m => m.tenantId === tenantId && m.userId === userId && !m.isSuspended);
    return membership ? { role: membership.role } : null;
};

/**
 * @route GET /api/v1/notes
 * @desc Get all notes for current tenant
 * @access Private (viewer+)
 */
router.get('/', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access) {
        throw new ForbiddenError('You do not have access to this tenant');
    }

    // Query params
    const {
        search,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
        page = 1,
        limit = 20,
        includeDeleted = false
    } = req.query;

    // Filter notes
    let filteredNotes = Array.from(notes.values())
        .filter(n => n.tenantId === tenantId);

    // Exclude deleted unless requested
    if (!includeDeleted) {
        filteredNotes = filteredNotes.filter(n => !n.isDeleted);
    }

    // Search
    if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        filteredNotes = filteredNotes.filter(n =>
            n.title.toLowerCase().includes(searchLower) ||
            n.content.toLowerCase().includes(searchLower)
        );
    }

    // Sort
    filteredNotes.sort((a, b) => {
        const aVal = a[sortBy as keyof Note];
        const bVal = b[sortBy as keyof Note];
        const order = sortOrder === 'asc' ? 1 : -1;

        if (aVal instanceof Date && bVal instanceof Date) {
            return (aVal.getTime() - bVal.getTime()) * order;
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal) * order;
        }
        return 0;
    });

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedNotes = filteredNotes.slice(startIndex, startIndex + limitNum);

    res.json({
        success: true,
        data: paginatedNotes,
        meta: {
            page: pageNum,
            limit: limitNum,
            total: filteredNotes.length,
            totalPages: Math.ceil(filteredNotes.length / limitNum),
        },
    });
}));

/**
 * @route GET /api/v1/notes/:noteId
 * @desc Get note details
 * @access Private (viewer+)
 */
router.get('/:noteId', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access) {
        throw new ForbiddenError('You do not have access to this tenant');
    }

    const note = notes.get(noteId);
    if (!note || note.tenantId !== tenantId) {
        throw new NotFoundError('Note', noteId);
    }

    if (note.isDeleted) {
        throw new NotFoundError('Note', noteId);
    }

    res.json({
        success: true,
        data: note,
    });
}));

/**
 * @route POST /api/v1/notes
 * @desc Create a new note
 * @access Private (editor+)
 */
router.post('/', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { title, content = '' } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access) {
        throw new ForbiddenError('You do not have access to this tenant');
    }

    // Check permission
    if (access.role === Role.VIEWER) {
        throw new ForbiddenError('Viewers cannot create notes');
    }

    if (!title || title.trim().length === 0) {
        throw new ValidationError('Note title is required');
    }

    if (title.length > 500) {
        throw new ValidationError('Title cannot exceed 500 characters');
    }

    const note: Note = {
        id: uuidv4(),
        tenantId,
        title: title.trim(),
        content,
        createdBy: userId,
        lastModifiedBy: userId,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    notes.set(note.id, note);

    res.status(201).json({
        success: true,
        data: note,
    });
}));

/**
 * @route PUT /api/v1/notes/:noteId
 * @desc Update a note
 * @access Private (editor+)
 */
router.put('/:noteId', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.params;
    const { title, content } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access) {
        throw new ForbiddenError('You do not have access to this tenant');
    }

    if (access.role === Role.VIEWER) {
        throw new ForbiddenError('Viewers cannot edit notes');
    }

    const note = notes.get(noteId);
    if (!note || note.tenantId !== tenantId || note.isDeleted) {
        throw new NotFoundError('Note', noteId);
    }

    // Update fields
    if (title !== undefined) {
        if (title.trim().length === 0) {
            throw new ValidationError('Note title cannot be empty');
        }
        if (title.length > 500) {
            throw new ValidationError('Title cannot exceed 500 characters');
        }
        note.title = title.trim();
    }

    if (content !== undefined) {
        note.content = content;
    }

    note.lastModifiedBy = userId;
    note.updatedAt = new Date();

    res.json({
        success: true,
        data: note,
    });
}));

/**
 * @route PATCH /api/v1/notes/:noteId/content
 * @desc Auto-save note content
 * @access Private (editor+)
 */
router.patch('/:noteId/content', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.params;
    const { content } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access || access.role === Role.VIEWER) {
        throw new ForbiddenError('Cannot edit notes');
    }

    const note = notes.get(noteId);
    if (!note || note.tenantId !== tenantId || note.isDeleted) {
        throw new NotFoundError('Note', noteId);
    }

    note.content = content;
    note.lastModifiedBy = userId;
    note.updatedAt = new Date();

    res.json({
        success: true,
        data: {
            id: note.id,
            updatedAt: note.updatedAt,
        },
    });
}));

/**
 * @route DELETE /api/v1/notes/:noteId
 * @desc Delete a note (soft delete)
 * @access Private (editor+ for own notes, admin+ for any)
 */
router.delete('/:noteId', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.params;
    const { permanent = false } = req.query;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access) {
        throw new ForbiddenError('You do not have access to this tenant');
    }

    const note = notes.get(noteId);
    if (!note || note.tenantId !== tenantId) {
        throw new NotFoundError('Note', noteId);
    }

    // Permission check
    const isOwner = note.createdBy === userId;
    const isAdmin = access.role === Role.OWNER || access.role === Role.ADMIN;
    const canEdit = access.role !== Role.VIEWER;

    if (!canEdit) {
        throw new ForbiddenError('Viewers cannot delete notes');
    }

    if (!isOwner && !isAdmin) {
        throw new ForbiddenError('You can only delete notes you created');
    }

    if (permanent && isAdmin) {
        // Permanent delete
        notes.delete(noteId);
        res.json({
            success: true,
            data: {
                message: 'Note permanently deleted',
            },
        });
    } else {
        // Soft delete
        note.isDeleted = true;
        note.deletedAt = new Date();
        note.deletedBy = userId;
        note.updatedAt = new Date();

        res.json({
            success: true,
            data: {
                message: 'Note deleted',
            },
        });
    }
}));

/**
 * @route POST /api/v1/notes/:noteId/restore
 * @desc Restore a soft-deleted note
 * @access Private (admin+)
 */
router.post('/:noteId/restore', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const access = checkTenantAccess(tenantId, userId);
    if (!access || (access.role !== Role.OWNER && access.role !== Role.ADMIN)) {
        throw new ForbiddenError('Admin access required to restore notes');
    }

    const note = notes.get(noteId);
    if (!note || note.tenantId !== tenantId) {
        throw new NotFoundError('Note', noteId);
    }

    if (!note.isDeleted) {
        throw new ValidationError('Note is not deleted');
    }

    note.isDeleted = false;
    note.deletedAt = undefined;
    note.deletedBy = undefined;
    note.updatedAt = new Date();

    res.json({
        success: true,
        data: note,
    });
}));

// Export for attachments
export { notes };
export default router;
