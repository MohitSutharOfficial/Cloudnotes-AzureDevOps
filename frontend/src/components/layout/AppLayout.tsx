import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore, useUIStore } from '../../stores';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from '../common/ToastContainer';

const AppLayout: React.FC = () => {
    const { isAuthenticated, currentTenant } = useAuthStore();
    const { sidebarOpen } = useUIStore();

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Redirect to create workspace if no tenant
    if (!currentTenant) {
        return <Navigate to="/create-workspace" replace />;
    }

    return (
        <div className="app-layout">
            <Sidebar isOpen={sidebarOpen} />

            <div className="main-content">
                <Header />

                <main className="page-content">
                    <Outlet />
                </main>
            </div>

            <ToastContainer />
        </div>
    );
};

export default AppLayout;
