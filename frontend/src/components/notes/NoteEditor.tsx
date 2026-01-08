import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Paperclip, Upload, Trash2 } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Input } from '../common';
import { useAuthStore, toast } from '../../stores';
import { notesApi, attachmentsApi } from '../../services/api';
import type { Note, Attachment } from '../../types';
import { canEdit } from '../../types';

interface NoteEditorProps {
    note: Note;
    onClose: () => void;
    onUpdate: (note: Note) => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, onClose, onUpdate }) => {
    const { currentRole } = useAuthStore();
    const [title, setTitle] = useState(note.title);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);

    const isEditable = canEdit(currentRole);

    // Editor setup
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Start writing your note...',
            }),
        ],
        content: note.content,
        editable: isEditable,
        onUpdate: () => {
            setHasChanges(true);
        },
    });

    // Load attachments
    useEffect(() => {
        const loadAttachments = async () => {
            try {
                const response = await attachmentsApi.list(note.id);
                setAttachments(response.data.data as Attachment[]);
            } catch (error) {
                console.error('Failed to load attachments:', error);
            }
        };
        loadAttachments();
    }, [note.id]);

    // Auto-save
    const autoSave = useCallback(async () => {
        if (!hasChanges || !isEditable) return;

        try {
            setIsSaving(true);
            await notesApi.autoSave(note.id, editor?.getHTML() || '');
            setLastSaved(new Date());
            setHasChanges(false);
        } catch (error) {
            console.error('Auto-save failed:', error);
        } finally {
            setIsSaving(false);
        }
    }, [hasChanges, isEditable, note.id, editor]);

    useEffect(() => {
        const timer = setInterval(autoSave, 5000); // Auto-save every 5 seconds
        return () => clearInterval(timer);
    }, [autoSave]);

    // Save handler
    const handleSave = async () => {
        try {
            setIsSaving(true);
            const response = await notesApi.update(note.id, {
                title,
                content: editor?.getHTML() || '',
            });
            onUpdate(response.data.data as Note);
            setLastSaved(new Date());
            setHasChanges(false);
            toast.success('Note saved');
        } catch (error: any) {
            toast.error('Failed to save', error.response?.data?.error?.message);
        } finally {
            setIsSaving(false);
        }
    };

    // File upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            setIsUploadingFiles(true);
            const response = await attachmentsApi.upload(note.id, Array.from(files));
            setAttachments([...attachments, ...(response.data.data as Attachment[])]);
            toast.success('Files uploaded');
        } catch (error: any) {
            toast.error('Upload failed', error.response?.data?.error?.message);
        } finally {
            setIsUploadingFiles(false);
        }
    };

    // Delete attachment
    const handleDeleteAttachment = async (attachmentId: string) => {
        try {
            await attachmentsApi.delete(attachmentId);
            setAttachments(attachments.filter(a => a.id !== attachmentId));
            toast.success('Attachment deleted');
        } catch (error: any) {
            toast.error('Failed to delete', error.response?.data?.error?.message);
        }
    };

    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div
            className="modal-overlay"
            style={{ alignItems: 'stretch', padding: 0 }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    maxWidth: 900,
                    margin: 'var(--space-xl) auto',
                    background: 'var(--surface-100)',
                    borderRadius: 'var(--radius-2xl)',
                    overflow: 'hidden',
                    animation: 'slideUp var(--transition-normal)'
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-md) var(--space-lg)',
                        borderBottom: '1px solid var(--border-color)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <button className="btn btn-ghost btn-icon" onClick={onClose}>
                            <X size={20} />
                        </button>
                        {lastSaved && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                {isSaving ? 'Saving...' : `Last saved ${lastSaved.toLocaleTimeString()}`}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        {isEditable && (
                            <>
                                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                    <Paperclip size={16} />
                                    {isUploadingFiles ? 'Uploading...' : 'Attach'}
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                        disabled={isUploadingFiles}
                                    />
                                </label>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    isLoading={isSaving}
                                    leftIcon={<Save size={16} />}
                                >
                                    Save
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-xl)' }}>
                    {/* Title */}
                    {isEditable ? (
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                setHasChanges(true);
                            }}
                            placeholder="Note title"
                            style={{
                                width: '100%',
                                border: 'none',
                                background: 'transparent',
                                fontSize: 'var(--text-3xl)',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginBottom: 'var(--space-lg)',
                                outline: 'none'
                            }}
                        />
                    ) : (
                        <h1 style={{ marginBottom: 'var(--space-lg)' }}>{title}</h1>
                    )}

                    {/* Editor */}
                    <div
                        style={{
                            minHeight: 300,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.7
                        }}
                    >
                        <EditorContent
                            editor={editor}
                            style={{
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Attachments */}
                    {attachments.length > 0 && (
                        <div style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-color)' }}>
                            <h4 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                Attachments ({attachments.length})
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                {attachments.map(attachment => (
                                    <div
                                        key={attachment.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            padding: 'var(--space-sm) var(--space-md)',
                                            background: 'var(--surface-200)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--text-sm)'
                                        }}
                                    >
                                        <Paperclip size={14} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {attachment.originalName}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                                            {formatFileSize(attachment.sizeBytes)}
                                        </span>
                                        {isEditable && (
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => handleDeleteAttachment(attachment.id)}
                                                style={{ padding: 4 }}
                                            >
                                                <Trash2 size={12} style={{ color: 'var(--error)' }} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NoteEditor;
