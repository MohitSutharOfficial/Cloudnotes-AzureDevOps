import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Tenant, Role } from '../types';
import { authApi, tenantsApi } from '../services/api';

interface AuthStore {
    // State
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    currentTenant: Tenant | null;
    currentRole: Role | null;
    tenants: Tenant[];
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    logout: () => void;
    setUser: (user: User) => void;
    setTokens: (accessToken: string, refreshToken: string) => void;
    setCurrentTenant: (tenant: Tenant, role: Role, token?: string) => void;
    loadTenants: () => Promise<void>;
    switchTenant: (tenantId: string) => Promise<void>;
    refreshUserProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set, get) => ({
            // Initial state
            user: null,
            token: null,
            refreshToken: null,
            currentTenant: null,
            currentRole: null,
            tenants: [],
            isLoading: false,
            isAuthenticated: false,

            // Login
            login: async (email: string, password: string) => {
                set({ isLoading: true });
                try {
                    const response = await authApi.login({ email, password });
                    const { user, accessToken, refreshToken } = response.data.data!;

                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', refreshToken);

                    set({
                        user: user as User,
                        token: accessToken,
                        refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    // Load user's tenants after login
                    await get().loadTenants();
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            // Register
            register: async (email: string, password: string, name: string) => {
                set({ isLoading: true });
                try {
                    const response = await authApi.register({ email, password, name });
                    const { user, accessToken, refreshToken } = response.data.data!;

                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', refreshToken);

                    set({
                        user: user as User,
                        token: accessToken,
                        refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            // Logout
            logout: () => {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('currentTenantId');

                set({
                    user: null,
                    token: null,
                    refreshToken: null,
                    currentTenant: null,
                    currentRole: null,
                    tenants: [],
                    isAuthenticated: false,
                });
            },

            // Set user
            setUser: (user: User) => {
                set({ user });
            },

            // Set tokens
            setTokens: (accessToken: string, refreshToken: string) => {
                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('refreshToken', refreshToken);
                set({ token: accessToken, refreshToken, isAuthenticated: true });
            },

            // Set current tenant
            setCurrentTenant: (tenant: Tenant, role: Role, token?: string) => {
                localStorage.setItem('currentTenantId', tenant.id);
                if (token) {
                    localStorage.setItem('accessToken', token);
                }
                set({ currentTenant: tenant, currentRole: role, token: token || get().token });
            },

            // Load tenants
            loadTenants: async () => {
                try {
                    const response = await tenantsApi.list();
                    const tenants = response.data.data as Tenant[];

                    set({ tenants });

                    // If no current tenant but user has tenants, set the first one
                    const { currentTenant } = get();
                    if (!currentTenant && tenants.length > 0) {
                        const firstTenant = tenants[0];
                        await get().switchTenant(firstTenant.id);
                    }
                } catch (error) {
                    console.error('Failed to load tenants:', error);
                }
            },

            // Switch tenant
            switchTenant: async (tenantId: string) => {
                try {
                    const response = await tenantsApi.switch(tenantId);
                    const { tenant, role, accessToken } = response.data.data as {
                        tenant: Tenant;
                        role: Role;
                        accessToken: string;
                    };

                    get().setCurrentTenant(tenant, role, accessToken);
                } catch (error) {
                    console.error('Failed to switch tenant:', error);
                    throw error;
                }
            },

            // Refresh user profile
            refreshUserProfile: async () => {
                try {
                    const response = await authApi.getMe();
                    set({ user: response.data.data as User });
                } catch (error) {
                    console.error('Failed to refresh profile:', error);
                }
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                refreshToken: state.refreshToken,
                currentTenant: state.currentTenant,
                currentRole: state.currentRole,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
