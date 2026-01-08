import React, { useState, useEffect } from 'react';
import {
    Plus,
    Users,
    MoreVertical,
    Shield,
    Ban,
    Trash2,
    Mail,
    Crown,
    UserCog
} from 'lucide-react';
import { Button, Modal, Input, EmptyState } from '../components/common';
import { useAuthStore, toast } from '../stores';
import { membersApi } from '../services/api';
import type { TenantMember } from '../types';
import { Role, canAdmin, getRoleBadgeClass } from '../types';

const TeamPage: React.FC = () => {
    const { currentRole, user, currentTenant } = useAuthStore();
    const [members, setMembers] = useState<TenantMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<Role>(Role.VIEWER);
    const [isInviting, setIsInviting] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [roleChangeModal, setRoleChangeModal] = useState<{ member: TenantMember; isOpen: boolean } | null>(null);
    const [selectedRole, setSelectedRole] = useState<Role>(Role.VIEWER);

    const isAdmin = canAdmin(currentRole);

    // Load members
    useEffect(() => {
        const loadMembers = async () => {
            try {
                setIsLoading(true);
                const response = await membersApi.list();
                setMembers(response.data.data as TenantMember[]);
            } catch (error) {
                console.error('Failed to load members:', error);
                toast.error('Failed to load team members');
            } finally {
                setIsLoading(false);
            }
        };
        loadMembers();
    }, []);

    // Invite member
    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            toast.error('Email required', 'Please enter an email address');
            return;
        }

        try {
            setIsInviting(true);
            await membersApi.invite({ email: inviteEmail, role: inviteRole });
            toast.success('Invitation sent', `Invitation sent to ${inviteEmail}`);
            setIsInviteModalOpen(false);
            setInviteEmail('');
            setInviteRole(Role.VIEWER);
        } catch (error: any) {
            toast.error('Failed to invite', error.response?.data?.error?.message);
        } finally {
            setIsInviting(false);
        }
    };

    // Change role
    const handleChangeRole = async () => {
        if (!roleChangeModal?.member) return;

        try {
            await membersApi.updateRole(roleChangeModal.member.id, selectedRole);
            setMembers(members.map(m =>
                m.id === roleChangeModal.member.id ? { ...m, role: selectedRole } : m
            ));
            toast.success('Role updated');
            setRoleChangeModal(null);
        } catch (error: any) {
            toast.error('Failed to update role', error.response?.data?.error?.message);
        }
    };

    // Remove member
    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Are you sure you want to remove this member?')) return;

        try {
            await membersApi.remove(memberId);
            setMembers(members.filter(m => m.id !== memberId));
            toast.success('Member removed');
        } catch (error: any) {
            toast.error('Failed to remove member', error.response?.data?.error?.message);
        }
        setActiveDropdown(null);
    };

    // Suspend member
    const handleSuspendMember = async (memberId: string) => {
        try {
            await membersApi.suspend(memberId);
            setMembers(members.map(m =>
                m.id === memberId ? { ...m, isSuspended: true } : m
            ));
            toast.success('Member suspended');
        } catch (error: any) {
            toast.error('Failed to suspend member', error.response?.data?.error?.message);
        }
        setActiveDropdown(null);
    };

    // Get initials
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Role options
    const roleOptions = [
        { value: Role.ADMIN, label: 'Admin', description: 'Can manage team and settings' },
        { value: Role.EDITOR, label: 'Editor', description: 'Can create and edit content' },
        { value: Role.VIEWER, label: 'Viewer', description: 'Can only view content' },
    ];

    return (
        <div className="team-page">
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <div>
                    <h1 style={{ marginBottom: 'var(--space-xs)' }}>Team</h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Manage members in {currentTenant?.name}
                    </p>
                </div>

                {isAdmin && (
                    <Button
                        leftIcon={<Plus size={18} />}
                        onClick={() => setIsInviteModalOpen(true)}
                    >
                        Invite Member
                    </Button>
                )}
            </div>

            {/* Member Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                {[
                    { label: 'Total Members', value: members.length, icon: Users },
                    { label: 'Admins', value: members.filter(m => m.role === Role.ADMIN || m.role === Role.OWNER).length, icon: Shield },
                    { label: 'Editors', value: members.filter(m => m.role === Role.EDITOR).length, icon: UserCog },
                ].map((stat, i) => (
                    <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--surface-300)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--primary-light)'
                            }}
                        >
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stat.value}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Members List */}
            {isLoading ? (
                <div className="card">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton" style={{ height: 60, marginBottom: 'var(--space-sm)' }} />
                    ))}
                </div>
            ) : members.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No team members"
                    description="Start building your team by inviting members"
                    action={
                        isAdmin && (
                            <Button leftIcon={<Plus size={18} />} onClick={() => setIsInviteModalOpen(true)}>
                                Invite Member
                            </Button>
                        )
                    }
                />
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ textAlign: 'left', padding: 'var(--space-md) var(--space-lg)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>Member</th>
                                <th style={{ textAlign: 'left', padding: 'var(--space-md) var(--space-lg)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>Role</th>
                                <th style={{ textAlign: 'left', padding: 'var(--space-md) var(--space-lg)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>Joined</th>
                                <th style={{ width: 50 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(member => (
                                <tr
                                    key={member.id}
                                    style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        opacity: member.isSuspended ? 0.5 : 1
                                    }}
                                >
                                    <td style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                            <div className="avatar avatar-md">
                                                {member.user?.avatarUrl ? (
                                                    <img src={member.user.avatarUrl} alt={member.user.name} />
                                                ) : (
                                                    getInitials(member.user?.name || 'U')
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                                    {member.user?.name || 'Unknown User'}
                                                    {member.userId === user?.id && (
                                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>(you)</span>
                                                    )}
                                                    {member.isSuspended && (
                                                        <span className="badge badge-error">Suspended</span>
                                                    )}
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                                    {member.user?.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                                        <span className={`badge ${getRoleBadgeClass(member.role)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            {member.role === Role.OWNER && <Crown size={12} />}
                                            {member.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: 'var(--space-md) var(--space-lg)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                        {new Date(member.joinedAt).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                                        {isAdmin && member.role !== Role.OWNER && member.userId !== user?.id && (
                                            <div className="dropdown">
                                                <button
                                                    className="btn btn-ghost btn-icon"
                                                    onClick={() => setActiveDropdown(activeDropdown === member.id ? null : member.id)}
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                                {activeDropdown === member.id && (
                                                    <div className="dropdown-menu">
                                                        <button
                                                            className="dropdown-item"
                                                            onClick={() => {
                                                                setSelectedRole(member.role);
                                                                setRoleChangeModal({ member, isOpen: true });
                                                                setActiveDropdown(null);
                                                            }}
                                                        >
                                                            <Shield size={14} />
                                                            Change Role
                                                        </button>
                                                        {!member.isSuspended && (
                                                            <button
                                                                className="dropdown-item"
                                                                onClick={() => handleSuspendMember(member.id)}
                                                            >
                                                                <Ban size={14} />
                                                                Suspend
                                                            </button>
                                                        )}
                                                        <button
                                                            className="dropdown-item"
                                                            onClick={() => handleRemoveMember(member.id)}
                                                            style={{ color: 'var(--error)' }}
                                                        >
                                                            <Trash2 size={14} />
                                                            Remove
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Invite Modal */}
            <Modal
                isOpen={isInviteModalOpen}
                onClose={() => {
                    setIsInviteModalOpen(false);
                    setInviteEmail('');
                    setInviteRole(Role.VIEWER);
                }}
                title="Invite Team Member"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsInviteModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleInvite} isLoading={isInviting}>
                            Send Invite
                        </Button>
                    </>
                }
            >
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <Input
                        label="Email Address"
                        type="email"
                        placeholder="teammate@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                    />
                </div>

                <div>
                    <label className="input-label">Role</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
                        {roleOptions.map(option => (
                            <label
                                key={option.value}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 'var(--space-sm)',
                                    padding: 'var(--space-sm) var(--space-md)',
                                    background: inviteRole === option.value ? 'var(--surface-300)' : 'transparent',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    transition: 'background var(--transition-fast)'
                                }}
                            >
                                <input
                                    type="radio"
                                    name="role"
                                    value={option.value}
                                    checked={inviteRole === option.value}
                                    onChange={() => setInviteRole(option.value)}
                                    style={{ marginTop: 4 }}
                                />
                                <div>
                                    <div style={{ fontWeight: 500 }}>{option.label}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                        {option.description}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Role Change Modal */}
            <Modal
                isOpen={!!roleChangeModal?.isOpen}
                onClose={() => setRoleChangeModal(null)}
                title="Change Role"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setRoleChangeModal(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleChangeRole}>
                            Update Role
                        </Button>
                    </>
                }
            >
                <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--text-secondary)' }}>
                    Change the role for {roleChangeModal?.member?.user?.name}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {roleOptions.map(option => (
                        <label
                            key={option.value}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 'var(--space-sm)',
                                padding: 'var(--space-sm) var(--space-md)',
                                background: selectedRole === option.value ? 'var(--surface-300)' : 'transparent',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer'
                            }}
                        >
                            <input
                                type="radio"
                                name="newRole"
                                value={option.value}
                                checked={selectedRole === option.value}
                                onChange={() => setSelectedRole(option.value)}
                            />
                            <div>
                                <div style={{ fontWeight: 500 }}>{option.label}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                    {option.description}
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

export default TeamPage;
