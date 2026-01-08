import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Search,
    FileText,
    MoreVertical,
    Edit3,
    Trash2,
    Clock,
    User
} from 'lucide-react';
import { Button, Modal, Input, EmptyState } from '../components/common';
import { useAuthStore, toast } from '../stores';
import { notesApi } from '../services/api';
import type { Note } from '../types';
import { canEdit } from '../types';
import NoteEditor from '../components/notes/NoteEditor';

const NotesPage: React.FC = () => {
    const { currentRole } = useAuthStore();
    const [notes, setNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Load notes
    const loadNotes = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await notesApi.list({ search: search || undefined });
            setNotes(response.data.data as Note[]);
        } catch (error) {
            console.error('Failed to load notes:', error);
            toast.error('Failed to load notes');
        } finally {
            setIsLoading(false);
        }
    }, [search]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    // Create note
    const handleCreateNote = async () => {
        if (!newNoteTitle.trim()) {
            toast.error('Title required', 'Please enter a title for your note');
            return;
        }

        try {
            const response = await notesApi.create({ title: newNoteTitle, content: '' });
            const newNote = response.data.data as Note;
            setNotes([newNote, ...notes]);
            setSelectedNote(newNote);
            setIsCreateModalOpen(false);
            setIsEditorOpen(true);
            setNewNoteTitle('');
            toast.success('Note created');
        } catch (error: any) {
            toast.error('Failed to create note', error.response?.data?.error?.message);
        }
    };

    // Delete note
    const handleDeleteNote = async (noteId: string) => {
        try {
            await notesApi.delete(noteId);
            setNotes(notes.filter(n => n.id !== noteId));
            if (selectedNote?.id === noteId) {
                setSelectedNote(null);
                setIsEditorOpen(false);
            }
            toast.success('Note deleted');
        } catch (error: any) {
            toast.error('Failed to delete note', error.response?.data?.error?.message);
        }
        setActiveDropdown(null);
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString();
    };

    // Get preview text
    const getPreview = (content: string) => {
        const text = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
        return text.length > 100 ? text.substring(0, 100) + '...' : text || 'No content';
    };

    return (
        <div className="notes-page">
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <div>
                    <h1 style={{ marginBottom: 'var(--space-xs)' }}>Notes</h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {notes.length} note{notes.length !== 1 ? 's' : ''} in your workspace
                    </p>
                </div>

                {canEdit(currentRole) && (
                    <Button
                        leftIcon={<Plus size={18} />}
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        New Note
                    </Button>
                )}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 'var(--space-lg)', position: 'relative', maxWidth: 400 }}>
                <Search
                    size={18}
                    style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)'
                    }}
                />
                <input
                    type="text"
                    className="input"
                    placeholder="Search notes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: 40 }}
                />
            </div>

            {/* Notes Grid */}
            {isLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="card skeleton" style={{ height: 180 }} />
                    ))}
                </div>
            ) : notes.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title={search ? 'No notes found' : 'No notes yet'}
                    description={search ? 'Try adjusting your search terms' : 'Create your first note to get started'}
                    action={
                        canEdit(currentRole) && !search && (
                            <Button leftIcon={<Plus size={18} />} onClick={() => setIsCreateModalOpen(true)}>
                                Create Note
                            </Button>
                        )
                    }
                />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
                    {notes.map(note => (
                        <div
                            key={note.id}
                            className="card card-hover"
                            onClick={() => {
                                setSelectedNote(note);
                                setIsEditorOpen(true);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="card-header">
                                <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                                    {note.title}
                                </h4>
                                {canEdit(currentRole) && (
                                    <div className="dropdown" onClick={e => e.stopPropagation()}>
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            onClick={() => setActiveDropdown(activeDropdown === note.id ? null : note.id)}
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                        {activeDropdown === note.id && (
                                            <div className="dropdown-menu">
                                                <button
                                                    className="dropdown-item"
                                                    onClick={() => {
                                                        setSelectedNote(note);
                                                        setIsEditorOpen(true);
                                                        setActiveDropdown(null);
                                                    }}
                                                >
                                                    <Edit3 size={14} />
                                                    Edit
                                                </button>
                                                <button
                                                    className="dropdown-item"
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    style={{ color: 'var(--error)' }}
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <p className="card-body" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
                                {getPreview(note.content)}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={12} />
                                    {formatDate(note.updatedAt)}
                                </div>
                                {note.author && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <User size={12} />
                                        {note.author.name}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Note Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setNewNoteTitle('');
                }}
                title="Create New Note"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateNote}>
                            Create
                        </Button>
                    </>
                }
            >
                <Input
                    label="Note Title"
                    placeholder="Enter a title for your note"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    autoFocus
                />
            </Modal>

            {/* Note Editor */}
            {isEditorOpen && selectedNote && (
                <NoteEditor
                    note={selectedNote}
                    onClose={() => {
                        setIsEditorOpen(false);
                        setSelectedNote(null);
                    }}
                    onUpdate={(updatedNote) => {
                        setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n));
                    }}
                />
            )}
        </div>
    );
};

export default NotesPage;
