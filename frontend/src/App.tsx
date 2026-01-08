import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout';
import { ToastContainer } from './components/common';
import {
  LoginPage,
  RegisterPage,
  CreateWorkspacePage,
  NotesPage,
  TeamPage,
} from './pages';
import { useAuthStore } from './stores';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route wrapper (redirects to app if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, currentTenant } = useAuthStore();

  if (isAuthenticated && currentTenant) {
    return <Navigate to="/notes" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          {/* Semi-protected (must be logged in but no tenant required) */}
          <Route
            path="/create-workspace"
            element={
              <ProtectedRoute>
                <CreateWorkspacePage />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes with Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/notes" replace />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global Toast Container */}
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Placeholder pages
const FilesPage: React.FC = () => (
  <div>
    <h1 style={{ marginBottom: 'var(--space-md)' }}>Files</h1>
    <p style={{ color: 'var(--text-muted)' }}>File management coming soon...</p>
  </div>
);

const SettingsPage: React.FC = () => (
  <div>
    <h1 style={{ marginBottom: 'var(--space-md)' }}>Settings</h1>
    <p style={{ color: 'var(--text-muted)' }}>Workspace settings coming soon...</p>
  </div>
);

const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  return (
    <div>
      <h1 style={{ marginBottom: 'var(--space-md)' }}>Profile</h1>
      <div className="card" style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label className="input-label">Name</label>
          <p>{user?.name}</p>
        </div>
        <div>
          <label className="input-label">Email</label>
          <p>{user?.email}</p>
        </div>
      </div>
    </div>
  );
};

export default App;
