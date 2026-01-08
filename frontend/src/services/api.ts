import axios from 'axios';
import type { AxiosError } from 'axios';

// Define ApiResponse locally to avoid module resolution issues
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
}
// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://saas-learning-api-mohit.azurewebsites.net/api/v1';

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Add tenant context if available
        const tenantId = localStorage.getItem('currentTenantId');
        if (tenantId) {
            config.headers['X-Tenant-ID'] = tenantId;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiResponse>) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized - try to refresh token
        if (error.response?.status === 401 && originalRequest) {
            const refreshToken = localStorage.getItem('refreshToken');

            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                        refreshToken,
                    });

                    const { accessToken } = response.data.data;
                    localStorage.setItem('accessToken', accessToken);

                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // Refresh failed - logout user
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('currentTenantId');
                    window.location.href = '/login';
                }
            } else {
                // No refresh token - redirect to login
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

// ============================================
// Auth API
// ============================================

export const authApi = {
    register: (data: { email: string; password: string; name: string }) =>
        api.post<ApiResponse<{ user: unknown; accessToken: string; refreshToken: string }>>('/auth/register', data),

    login: (data: { email: string; password: string }) =>
        api.post<ApiResponse<{ user: unknown; accessToken: string; refreshToken: string }>>('/auth/login', data),

    logout: () =>
        api.post<ApiResponse>('/auth/logout'),

    getMe: () =>
        api.get<ApiResponse<unknown>>('/auth/me'),

    updateProfile: (data: { name?: string; avatarUrl?: string }) =>
        api.put<ApiResponse<unknown>>('/auth/me', data),

    forgotPassword: (email: string) =>
        api.post<ApiResponse>('/auth/forgot-password', { email }),
};

// ============================================
// Tenants API
// ============================================

export const tenantsApi = {
    list: () =>
        api.get<ApiResponse<unknown[]>>('/tenants'),

    get: (tenantId: string) =>
        api.get<ApiResponse<unknown>>(`/tenants/${tenantId}`),

    create: (data: { name: string; slug?: string }) =>
        api.post<ApiResponse<{ tenant: unknown; accessToken: string }>>('/tenants', data),

    update: (tenantId: string, data: { name?: string; logoUrl?: string }) =>
        api.put<ApiResponse<unknown>>(`/tenants/${tenantId}`, data),

    delete: (tenantId: string) =>
        api.delete<ApiResponse>(`/tenants/${tenantId}`),

    switch: (tenantId: string) =>
        api.post<ApiResponse<{ tenant: unknown; accessToken: string }>>(`/tenants/${tenantId}/switch`),
};

// ============================================
// Members API
// ============================================

export const membersApi = {
    list: () =>
        api.get<ApiResponse<unknown[]>>('/members'),

    invite: (data: { email: string; role: string }) =>
        api.post<ApiResponse<unknown>>('/members/invite', data),

    acceptInvite: (token: string) =>
        api.post<ApiResponse<unknown>>(`/members/invitations/${token}/accept`),

    updateRole: (memberId: string, role: string) =>
        api.put<ApiResponse<unknown>>(`/members/${memberId}/role`, { role }),

    remove: (memberId: string) =>
        api.delete<ApiResponse>(`/members/${memberId}`),

    suspend: (memberId: string) =>
        api.put<ApiResponse<unknown>>(`/members/${memberId}/suspend`),
};

// ============================================
// Notes API
// ============================================

export const notesApi = {
    list: (params?: { search?: string; page?: number; limit?: number }) =>
        api.get<ApiResponse<unknown[]>>('/notes', { params }),

    get: (noteId: string) =>
        api.get<ApiResponse<unknown>>(`/notes/${noteId}`),

    create: (data: { title: string; content: string }) =>
        api.post<ApiResponse<unknown>>('/notes', data),

    update: (noteId: string, data: { title?: string; content?: string }) =>
        api.put<ApiResponse<unknown>>(`/notes/${noteId}`, data),

    autoSave: (noteId: string, content: string) =>
        api.patch<ApiResponse<unknown>>(`/notes/${noteId}/content`, { content }),

    delete: (noteId: string) =>
        api.delete<ApiResponse>(`/notes/${noteId}`),

    restore: (noteId: string) =>
        api.post<ApiResponse<unknown>>(`/notes/${noteId}/restore`),
};

// ============================================
// Attachments API
// ============================================

export const attachmentsApi = {
    list: (noteId: string) =>
        api.get<ApiResponse<unknown[]>>('/attachments', { params: { noteId } }),

    upload: (noteId: string, files: File[]) => {
        const formData = new FormData();
        formData.append('noteId', noteId);
        files.forEach((file) => formData.append('files', file));

        return api.post<ApiResponse<unknown[]>>('/attachments', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    getDownloadUrl: (attachmentId: string) =>
        api.get<ApiResponse<{ downloadUrl: string }>>(`/attachments/${attachmentId}`),

    delete: (attachmentId: string) =>
        api.delete<ApiResponse>(`/attachments/${attachmentId}`),
};

// ============================================
// Health API
// ============================================

export const healthApi = {
    check: () =>
        api.get<ApiResponse<{ status: string }>>('/health'),
};

export default api;
