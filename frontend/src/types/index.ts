// ============================================
// Frontend Types for Multi-Tenant SaaS
// ============================================

// User Roles
export const Role = {
    OWNER: 'owner',
    ADMIN: 'admin',
    EDITOR: 'editor',
    VIEWER: 'viewer',
} as const;

export type Role = typeof Role[keyof typeof Role];

// Tenant Status
export const TenantStatus = {
    ACTIVE: 'active',
    SUSPENDED: 'suspended',
    DELETED: 'deleted',
} as const;

export type TenantStatus = typeof TenantStatus[keyof typeof TenantStatus];

// ============================================
// User Types
// ============================================

export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    emailVerified: boolean;
    createdAt: string;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

// ============================================
// Tenant Types
// ============================================

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    status: TenantStatus;
    ownerId: string;
    memberCount?: number;
    role?: Role;
    createdAt: string;
    updatedAt: string;
}

export interface TenantMember {
    id: string;
    tenantId: string;
    userId: string;
    role: Role;
    joinedAt: string;
    isSuspended: boolean;
    user?: User;
}

export interface Invitation {
    id: string;
    tenantId: string;
    email: string;
    role: Role;
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    expiresAt: string;
}

// ============================================
// Note Types
// ============================================

export interface Note {
    id: string;
    tenantId: string;
    title: string;
    content: string;
    createdBy: string;
    lastModifiedBy: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    author?: User;
    attachments?: Attachment[];
}

// ============================================
// Attachment Types
// ============================================

export interface Attachment {
    id: string;
    tenantId: string;
    noteId: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    blobUrl: string;
    uploadedBy: string;
    createdAt: string;
}

// ============================================
// API Types
// ============================================

export interface ApiResponse<T = unknown> {
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

export interface PaginatedResponse<T> {
    items: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

// ============================================
// Form Types
// ============================================

export interface LoginForm {
    email: string;
    password: string;
}

export interface RegisterForm {
    email: string;
    password: string;
    name: string;
}

export interface CreateTenantForm {
    name: string;
    slug?: string;
}

export interface CreateNoteForm {
    title: string;
    content: string;
}

export interface InviteMemberForm {
    email: string;
    role: Role;
}

// ============================================
// UI State Types
// ============================================

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    duration?: number;
}

export interface ModalState {
    isOpen: boolean;
    component?: React.ComponentType<unknown>;
    props?: Record<string, unknown>;
}

// ============================================
// Permission Helpers
// ============================================

export const canEdit = (role?: Role | null): boolean => {
    return role === Role.OWNER || role === Role.ADMIN || role === Role.EDITOR;
};

export const canAdmin = (role?: Role | null): boolean => {
    return role === Role.OWNER || role === Role.ADMIN;
};

export const isOwner = (role?: Role): boolean => {
    return role === Role.OWNER;
};

export const getRoleBadgeClass = (role: Role): string => {
    return `badge-${role}`;
};
