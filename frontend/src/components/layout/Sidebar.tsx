import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    FileText,
    Upload,
    Users,
    Settings,
    ChevronDown,
    Building2,
    LogOut,
    User,
    Plus
} from 'lucide-react';
import { useAuthStore } from '../../stores';
import { Role, getRoleBadgeClass } from '../../types';

interface SidebarProps {
    isOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true }) => {
    const navigate = useNavigate();
    const { user, currentTenant, currentRole, tenants, switchTenant, logout } = useAuthStore();
    const [tenantDropdownOpen, setTenantDropdownOpen] = React.useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);

    const handleSwitchTenant = async (tenantId: string) => {
        try {
            await switchTenant(tenantId);
            setTenantDropdownOpen(false);
        } catch (error) {
            console.error('Failed to switch tenant:', error);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const navItems = [
        { icon: FileText, label: 'Notes', path: '/notes', requiredRole: Role.VIEWER },
        { icon: Upload, label: 'Files', path: '/files', requiredRole: Role.VIEWER },
        { icon: Users, label: 'Team', path: '/team', requiredRole: Role.VIEWER },
        { icon: Settings, label: 'Settings', path: '/settings', requiredRole: Role.ADMIN },
    ];

    const filteredNavItems = navItems.filter(item => {
        if (!currentRole) return false;
        const roleHierarchy = { [Role.VIEWER]: 1, [Role.EDITOR]: 2, [Role.ADMIN]: 3, [Role.OWNER]: 4 };
        return roleHierarchy[currentRole] >= roleHierarchy[item.requiredRole];
    });

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* Logo & Tenant Switcher */}
            <div className="sidebar-header">
                <div className="relative">
                    <button
                        className="flex items-center gap-sm w-full p-md rounded-lg hover:bg-surface-300 transition-all"
                        onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                        style={{ background: tenantDropdownOpen ? 'var(--surface-300)' : 'transparent' }}
                    >
                        <div
                            className="flex items-center justify-center rounded-lg"
                            style={{
                                width: 36,
                                height: 36,
                                background: 'var(--gradient-primary)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 'var(--text-sm)'
                            }}
                        >
                            {currentTenant ? getInitials(currentTenant.name) : <Building2 size={18} />}
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                {currentTenant?.name || 'Select Workspace'}
                            </div>
                            {currentRole && (
                                <span
                                    className={`badge ${getRoleBadgeClass(currentRole)}`}
                                    style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                                >
                                    {currentRole}
                                </span>
                            )}
                        </div>
                        <ChevronDown
                            size={16}
                            style={{
                                color: 'var(--text-muted)',
                                transform: tenantDropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform var(--transition-fast)'
                            }}
                        />
                    </button>

                    {/* Tenant Dropdown */}
                    {tenantDropdownOpen && (
                        <div className="dropdown-menu" style={{ left: 0, right: 0, top: 'calc(100% + 4px)' }}>
                            {tenants.map(tenant => (
                                <div
                                    key={tenant.id}
                                    className="dropdown-item"
                                    onClick={() => handleSwitchTenant(tenant.id)}
                                    style={{
                                        background: tenant.id === currentTenant?.id ? 'var(--surface-400)' : 'transparent'
                                    }}
                                >
                                    <div
                                        className="flex items-center justify-center rounded-md"
                                        style={{
                                            width: 28,
                                            height: 28,
                                            background: 'var(--gradient-primary)',
                                            color: 'white',
                                            fontWeight: 500,
                                            fontSize: 'var(--text-xs)'
                                        }}
                                    >
                                        {getInitials(tenant.name)}
                                    </div>
                                    <span>{tenant.name}</span>
                                    {tenant.role && (
                                        <span className={`badge ${getRoleBadgeClass(tenant.role)}`} style={{ marginLeft: 'auto', fontSize: '0.6rem' }}>
                                            {tenant.role}
                                        </span>
                                    )}
                                </div>
                            ))}
                            <div className="dropdown-divider" />
                            <Link to="/create-workspace" className="dropdown-item" onClick={() => setTenantDropdownOpen(false)}>
                                <Plus size={16} />
                                <span>Create Workspace</span>
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {filteredNavItems.map(item => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className="nav-item"
                    >
                        <item.icon size={20} className="nav-item-icon" />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            {/* User Profile */}
            <div className="sidebar-footer">
                <div className="relative">
                    <button
                        className="flex items-center gap-sm w-full p-md rounded-lg hover:bg-surface-300 transition-all"
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        style={{ background: userDropdownOpen ? 'var(--surface-300)' : 'transparent' }}
                    >
                        <div className="avatar avatar-sm">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} />
                            ) : (
                                getInitials(user?.name || 'U')
                            )}
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                {user?.name}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {user?.email}
                            </div>
                        </div>
                    </button>

                    {userDropdownOpen && (
                        <div className="dropdown-menu" style={{ left: 0, right: 0, bottom: 'calc(100% + 4px)', top: 'auto' }}>
                            <Link to="/profile" className="dropdown-item" onClick={() => setUserDropdownOpen(false)}>
                                <User size={16} />
                                <span>Profile</span>
                            </Link>
                            <div className="dropdown-divider" />
                            <button className="dropdown-item" onClick={handleLogout} style={{ width: '100%', color: 'var(--error)' }}>
                                <LogOut size={16} />
                                <span>Log out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
