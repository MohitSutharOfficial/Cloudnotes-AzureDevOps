import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Sparkles } from 'lucide-react';
import { Button, Input } from '../components/common';
import { useAuthStore, toast } from '../stores';
import { tenantsApi } from '../services/api';

const CreateWorkspacePage: React.FC = () => {
    const navigate = useNavigate();
    const { setCurrentTenant, loadTenants } = useAuthStore();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});

    // Auto-generate slug from name
    const handleNameChange = (value: string) => {
        setName(value);
        if (!slug || slug === generateSlug(name)) {
            setSlug(generateSlug(value));
        }
    };

    const generateSlug = (text: string) => {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    };

    const validate = () => {
        const newErrors: { name?: string; slug?: string } = {};

        if (!name || name.trim().length < 2) {
            newErrors.name = 'Workspace name must be at least 2 characters';
        }

        if (slug && !/^[a-z0-9-]+$/.test(slug)) {
            newErrors.slug = 'URL can only contain lowercase letters, numbers, and hyphens';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsLoading(true);
        try {
            const response = await tenantsApi.create({ name, slug: slug || undefined });
            const { tenant, membership, accessToken } = response.data.data as any;

            setCurrentTenant(tenant, membership.role, accessToken);
            await loadTenants();

            toast.success('Workspace created!', `Welcome to ${tenant.name}`);
            navigate('/notes');
        } catch (error: any) {
            const message = error.response?.data?.error?.message || 'Failed to create workspace';
            toast.error('Creation failed', message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-lg)'
            }}
        >
            <div className="card" style={{ width: '100%', maxWidth: 500 }}>
                {/* Header */}
                <div className="text-center" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 80,
                            height: 80,
                            background: 'var(--gradient-primary)',
                            borderRadius: 'var(--radius-2xl)',
                            marginBottom: 'var(--space-lg)',
                            boxShadow: 'var(--shadow-glow-strong)'
                        }}
                    >
                        <Building2 size={40} color="white" />
                    </div>
                    <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-sm)' }}>
                        Create your workspace
                    </h1>
                    <p style={{ color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto' }}>
                        A workspace is where your team collaborates. You can invite members and organize your notes and files.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <Input
                            label="Workspace Name"
                            type="text"
                            placeholder="Acme Inc."
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            error={errors.name}
                        />
                    </div>

                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <Input
                            label="Workspace URL (optional)"
                            type="text"
                            placeholder="acme-inc"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase())}
                            error={errors.slug}
                            helperText={slug ? `Your workspace will be at: app.example.com/${slug}` : undefined}
                        />
                    </div>

                    {/* Features preview */}
                    <div
                        style={{
                            background: 'var(--surface-200)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-lg)',
                            marginBottom: 'var(--space-xl)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <Sparkles size={18} style={{ color: 'var(--warning)' }} />
                            <span style={{ fontWeight: 600 }}>What you'll get</span>
                        </div>
                        <ul style={{ listStyle: 'none', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                            {[
                                'Unlimited notes with rich text editing',
                                'Secure file storage with Azure Blob',
                                'Team collaboration with role-based access',
                                'Real-time auto-save',
                                'Full-text search across all content'
                            ].map((feature, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 8 }}>
                                    <span style={{ color: 'var(--success)' }}>✓</span>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <Button
                        type="submit"
                        isLoading={isLoading}
                        style={{ width: '100%' }}
                    >
                        Create Workspace
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default CreateWorkspacePage;
