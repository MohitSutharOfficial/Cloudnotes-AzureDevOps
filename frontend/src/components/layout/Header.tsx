import React from 'react';
import { Search, Bell, Menu } from 'lucide-react';
import { useUIStore, useAuthStore } from '../../stores';

const Header: React.FC = () => {
    const { toggleSidebar, globalSearch, setGlobalSearch } = useUIStore();
    const { currentTenant } = useAuthStore();

    return (
        <header className="header">
            <div className="flex items-center gap-md">
                <button
                    className="btn btn-ghost btn-icon"
                    onClick={toggleSidebar}
                    style={{ display: 'none' }} // Show on mobile
                >
                    <Menu size={20} />
                </button>

                {/* Search */}
                <div className="relative" style={{ width: 320 }}>
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
                        placeholder="Search notes, files..."
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        style={{ paddingLeft: 40 }}
                    />
                </div>
            </div>

            <div className="flex items-center gap-md">
                {currentTenant && (
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {currentTenant.memberCount || 0} members
                    </span>
                )}

                {/* Notifications */}
                <button className="btn btn-ghost btn-icon" style={{ position: 'relative' }}>
                    <Bell size={20} />
                    <span
                        style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 8,
                            height: 8,
                            background: 'var(--error)',
                            borderRadius: '50%',
                            border: '2px solid var(--surface-100)'
                        }}
                    />
                </button>
            </div>
        </header>
    );
};

export default Header;
