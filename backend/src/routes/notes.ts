import { Router, Request, Response } from 'express';
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

/**
 * @route POST /api/v1/notes
 * @desc Create a new note
 * @access Private (Editor+)
 */
router.post('/', authenticate, requireTenant, requireMinRole(Role.EDITOR), asyncHandler(async (req: Request, res: Response) => {
    const { title, content, tags } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    if (!title || title.trim().length === 0) {
        throw new ValidationError('Title is required');
    }

    const result = await pool.request()
        .input('tenant_id', tenantId)
        .input('title', title.trim())
        .input('content', content || '')
        .input('tags', tags ? JSON.stringify(tags) : null)
        .input('created_by', userId)
        .query(`
            INSERT INTO notes (id, tenant_id, title, content, tags, created_by, created_at, updated_at, is_deleted)
            OUTPUT INSERTED.*
            VALUES (NEWID(), @tenant_id, @title, @content, @tags, @created_by, GETUTCDATE(), GETUTCDATE(), 0)
        `);

    const note = result.recordset[0];

    logger.info('Note created', { noteId: note.id, tenantId, userId });

    res.status(201).json({
        success: true,
        data: {
            id: note.id,
            tenantId: note.tenant_id,
            title: note.title,
            content: note.content,
            tags: note.tags ? JSON.parse(note.tags) : [],
            createdBy: note.created_by,
            createdAt: note.created_at,
            updatedAt: note.updated_at,
        },
    });
}));

/**
 * @route GET /api/v1/notes
 * @desc Get all notes for tenant
 * @access Private (Viewer+)
 */
router.get('/', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const { search, tags, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE n.tenant_id = @tenant_id AND n.is_deleted = 0';
    const request = pool.request()
        .input('tenant_id', tenantId)
        .input('limit', limitNum)
        .input('offset', offset);

    if (search) {
        whereClause += ' AND (n.title LIKE @search OR n.content LIKE @search)';
        request.input('search', `%${search}%`);
    }

    if (tags) {
        const tagArray = (tags as string).split(',');
        whereClause += ' AND n.tags LIKE @tag_search';
        request.input('tag_search', `%${tagArray[0]}%`); // Simple tag search
    }

    const result = await request.query(`
        SELECT 
            n.id, n.tenant_id, n.title, n.content, n.tags, n.created_by, n.updated_by,
            n.created_at, n.updated_at,
            u.name as creator_name
        FROM notes n
        LEFT JOIN users u ON n.created_by = u.id
        ${whereClause}
        ORDER BY n.updated_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
    `);

    const countResult = await pool.request()
        .input('tenant_id', tenantId)
        .query(`
            SELECT COUNT(*) as total
            FROM notes
            WHERE tenant_id = @tenant_id AND is_deleted = 0
        `);

    const notes = result.recordset.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        title: row.title,
        content: row.content,
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdBy: row.created_by,
        creatorName: row.creator_name,
        updatedBy: row.updated_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));

    res.json({
        success: true,
        data: notes,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: countResult.recordset[0].total,
            totalPages: Math.ceil(countResult.recordset[0].total / limitNum),
        },
    });
}));

/**
 * @route GET /api/v1/notes/:noteId
 * @desc Get a single note
 * @access Private (Viewer+)
 */
router.get('/:noteId', authenticate, requireTenant, asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.params;
    const tenantId = req.tenantId!;

    const result = await pool.request()
        .input('note_id', noteId)
        .input('tenant_id', tenantId)
        .query(`
            SELECT 
                n.id, n.tenant_id, n.title, n.content, n.tags, n.created_by, n.updated_by,
                n.created_at, n.updated_at,
                u1.name as creator_name,
                u2.name as updater_name
            FROM notes n
            LEFT JOIN users u1 ON n.created_by = u1.id
            LEFT JOIN users u2 ON n.updated_by = u2.id
            WHERE n.id = @note_id AND n.tenant_id = @tenant_id AND n.is_deleted = 0
        `);

    if (result.recordset.length === 0) {
        throw new NotFoundError('Note not found');
    }

    const note = result.recordset[0];

    res.json({
        success: true,
        data: {
            id: note.id,
            tenantId: note.tenant_id,
            title: note.title,
            content: note.content,
            tags: note.tags ? JSON.parse(note.tags) : [],
            createdBy: note.created_by,
            creatorName: note.creator_name,
            updatedBy: note.updated_by,
            updaterName: note.updater_name,
            createdAt: note.created_at,
            updatedAt: note.updated_at,
        },
    });
}));

/**
 * @route PUT /api/v1/notes/:noteId
 * @desc Update a note
 * @access Private (Editor+)
 */
router.put('/:noteId', authenticate, requireTenant, requireMinRole(Role.EDITOR), asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.params;
    const { title, content, tags } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    // Verify note exists and belongs to tenant
    const noteCheck = await pool.request()
        .input('note_id', noteId)
        .input('tenant_id', tenantId)
        .query('SELECT id FROM notes WHERE id = @note_id AND tenant_id = @tenant_id AND is_deleted = 0');

    if (noteCheck.recordset.length === 0) {
        throw new NotFoundError('Note not found');
    }

    const updates: string[] = [];
    const request = pool.request()
        .input('note_id', noteId)
        .input('tenant_id', tenantId)
        .input('updated_by', userId);

    if (title !== undefined) {
        if (title.trim().length === 0) {
            throw new ValidationError('Title cannot be empty');
        }
        updates.push('title = @title');
        request.input('title', title.trim());
    }

    if (content !== undefined) {
        updates.push('content = @content');
        request.input('content', content);
    }

    if (tags !== undefined) {
        updates.push('tags = @tags');
        request.input('tags', tags ? JSON.stringify(tags) : null);
    }

    if (updates.length === 0) {
        throw new ValidationError('No valid fields to update');
    }

    updates.push('updated_by = @updated_by');
    updates.push('updated_at = GETUTCDATE()');

    await request.query(`
        UPDATE notes
        SET ${updates.join(', ')}
        WHERE id = @note_id AND tenant_id = @tenant_id
    `);

    const result = await pool.request()
        .input('note_id', noteId)
        .query('SELECT * FROM notes WHERE id = @note_id');

    const note = result.recordset[0];

    logger.info('Note updated', { noteId, tenantId, userId });

    res.json({
        success: true,
        data: {
            id: note.id,
            tenantId: note.tenant_id,
            title: note.title,
            content: note.content,
            tags: note.tags ? JSON.parse(note.tags) : [],
            createdBy: note.created_by,
            updatedBy: note.updated_by,
            createdAt: note.created_at,
            updatedAt: note.updated_at,
        },
    });
}));

/**
 * @route DELETE /api/v1/notes/:noteId
 * @desc Soft delete a note
 * @access Private (Editor+)
 */
router.delete('/:noteId', authenticate, requireTenant, requireMinRole(Role.EDITOR), asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    // Verify note exists
    const noteCheck = await pool.request()
        .input('note_id', noteId)
        .input('tenant_id', tenantId)
        .query('SELECT id FROM notes WHERE id = @note_id AND tenant_id = @tenant_id AND is_deleted = 0');

    if (noteCheck.recordset.length === 0) {
        throw new NotFoundError('Note not found');
    }

    // Soft delete
    await pool.request()
        .input('note_id', noteId)
        .input('tenant_id', tenantId)
        .input('deleted_by', userId)
        .query(`
            UPDATE notes
            SET is_deleted = 1, deleted_by = @deleted_by, deleted_at = GETUTCDATE()
            WHERE id = @note_id AND tenant_id = @tenant_id
        `);

    logger.info('Note deleted', { noteId, tenantId, userId });

    res.json({
        success: true,
        data: {
            message: 'Note deleted successfully',
        },
    });
}));

export default router;
