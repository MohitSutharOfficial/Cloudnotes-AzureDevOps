// ============================================
// Core Types for Multi-Tenant SaaS Application
// ============================================

// User Roles
export enum Role {
    OWNER = 'owner',
    ADMIN = 'admin',
    EDITOR = 'editor',
    VIEWER = 'viewer',
}

// Role Hierarchy (higher number = more permissions)
export const RoleHierarchy: Record<Role, number> = {
    [Role.VIEWER]: 1,
    [Role.EDITOR]: 2,
    [Role.ADMIN]: 3,
    [Role.OWNER]: 4,
};

// Tenant Status
export enum TenantStatus {
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    DELETED = 'deleted',
}

// Invitation Status
export enum InvitationStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
    EXPIRED = 'expired',
}

// Base Entity
export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// User Types
// ============================================

export interface User extends BaseEntity {
    email: string;
    name: string;
    avatarUrl?: string;
    emailVerified: boolean;
    azureAdObjectId?: string; // For Azure AD B2C
    lastLoginAt?: Date;
}

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
}

// ============================================
// Tenant (Organization) Types
// ============================================

export interface Tenant extends BaseEntity {
    name: string;
    slug: string; // URL-friendly identifier
    logoUrl?: string;
    status: TenantStatus;
    ownerId: string;
    settings?: TenantSettings;
}

export interface TenantSettings {
    allowPublicSignup?: boolean;
    defaultRole?: Role;
    maxMembers?: number;
    maxStorageBytes?: number;
    features?: string[];
}

// ============================================
// Membership Types
// ============================================

export interface TenantMember extends BaseEntity {
    tenantId: string;
    userId: string;
    role: Role;
    joinedAt: Date;
    invitedBy?: string;
    isSuspended: boolean;
}

export interface TenantMemberWithUser extends TenantMember {
    user: UserProfile;
}

export interface TenantMemberWithTenant extends TenantMember {
    tenant: Tenant;
}

// ============================================
// Invitation Types
// ============================================

export interface Invitation extends BaseEntity {
    tenantId: string;
    email: string;
    role: Role;
    status: InvitationStatus;
    invitedBy: string;
    expiresAt: Date;
    token: string;
}

// ============================================
// Note Types
// ============================================

export interface Note extends BaseEntity {
    tenantId: string;
    title: string;
    content: string; // Rich text / Markdown
    createdBy: string;
    lastModifiedBy: string;
    isDeleted: boolean;
    deletedAt?: Date;
    deletedBy?: string;
}

export interface NoteWithAuthor extends Note {
    author: UserProfile;
    lastEditor: UserProfile;
    attachments?: Attachment[];
}

// ============================================
// Attachment Types
// ============================================

export interface Attachment extends BaseEntity {
    tenantId: string;
    noteId: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    blobUrl: string; // Azure Blob Storage URL
    uploadedBy: string;
    isDeleted: boolean;
}

// ============================================
// Audit Log Types
// ============================================

export interface AuditLog extends BaseEntity {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

// ============================================
// API Types
// ============================================

export interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    tenantId?: string;
    role?: Role;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
    query?: string;
    filters?: Record<string, any>;
}

// ============================================
// Request Types
// ============================================

export interface CreateTenantRequest {
    name: string;
    slug?: string;
}

export interface UpdateTenantRequest {
    name?: string;
    logoUrl?: string;
    settings?: Partial<TenantSettings>;
}

export interface InviteMemberRequest {
    email: string;
    role: Role;
}

export interface UpdateMemberRoleRequest {
    role: Role;
}

export interface CreateNoteRequest {
    title: string;
    content: string;
}

export interface UpdateNoteRequest {
    title?: string;
    content?: string;
}

// ============================================
// Permission Types
// ============================================

export enum Permission {
    // Tenant permissions
    TENANT_READ = 'tenant:read',
    TENANT_UPDATE = 'tenant:update',
    TENANT_DELETE = 'tenant:delete',

    // Member permissions
    MEMBER_READ = 'member:read',
    MEMBER_INVITE = 'member:invite',
    MEMBER_REMOVE = 'member:remove',
    MEMBER_UPDATE_ROLE = 'member:update_role',

    // Note permissions
    NOTE_CREATE = 'note:create',
    NOTE_READ = 'note:read',
    NOTE_UPDATE = 'note:update',
    NOTE_DELETE = 'note:delete',

    // Attachment permissions
    ATTACHMENT_UPLOAD = 'attachment:upload',
    ATTACHMENT_DOWNLOAD = 'attachment:download',
    ATTACHMENT_DELETE = 'attachment:delete',

    // Admin permissions
    ADMIN_ANALYTICS = 'admin:analytics',
    ADMIN_SETTINGS = 'admin:settings',
    ADMIN_AUDIT_LOGS = 'admin:audit_logs',
}

// Role-Permission mapping
export const RolePermissions: Record<Role, Permission[]> = {
    [Role.VIEWER]: [
        Permission.TENANT_READ,
        Permission.MEMBER_READ,
        Permission.NOTE_READ,
        Permission.ATTACHMENT_DOWNLOAD,
    ],
    [Role.EDITOR]: [
        Permission.TENANT_READ,
        Permission.MEMBER_READ,
        Permission.NOTE_CREATE,
        Permission.NOTE_READ,
        Permission.NOTE_UPDATE,
        Permission.ATTACHMENT_UPLOAD,
        Permission.ATTACHMENT_DOWNLOAD,
    ],
    [Role.ADMIN]: [
        Permission.TENANT_READ,
        Permission.TENANT_UPDATE,
        Permission.MEMBER_READ,
        Permission.MEMBER_INVITE,
        Permission.MEMBER_REMOVE,
        Permission.MEMBER_UPDATE_ROLE,
        Permission.NOTE_CREATE,
        Permission.NOTE_READ,
        Permission.NOTE_UPDATE,
        Permission.NOTE_DELETE,
        Permission.ATTACHMENT_UPLOAD,
        Permission.ATTACHMENT_DOWNLOAD,
        Permission.ATTACHMENT_DELETE,
        Permission.ADMIN_ANALYTICS,
        Permission.ADMIN_SETTINGS,
    ],
    [Role.OWNER]: [
        // Owner has all permissions
        ...Object.values(Permission),
    ],
};
