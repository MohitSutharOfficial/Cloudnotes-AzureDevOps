-- ============================================
-- Multi-Tenant SaaS Database Schema
-- Compatible with Azure SQL / SQL Server
-- ============================================

-- Enable UUID extension equivalent
-- SQL Server uses UNIQUEIDENTIFIER type

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) NOT NULL UNIQUE,
    name NVARCHAR(255) NOT NULL,
    password_hash NVARCHAR(255), -- NULL for Azure AD B2C users
    avatar_url NVARCHAR(500),
    email_verified BIT DEFAULT 0,
    azure_ad_object_id NVARCHAR(255) UNIQUE, -- For Azure AD B2C
    last_login_at DATETIME2,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_azure_ad ON users(azure_ad_object_id);

-- ============================================
-- Tenants (Organizations) Table
-- ============================================
CREATE TABLE tenants (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    slug NVARCHAR(100) NOT NULL UNIQUE,
    logo_url NVARCHAR(500),
    status NVARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    owner_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id),
    settings NVARCHAR(MAX), -- JSON for flexible settings
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_owner ON tenants(owner_id);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ============================================
-- Tenant Members Table
-- ============================================
CREATE TABLE tenant_members (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    tenant_id UNIQUEIDENTIFIER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role NVARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    joined_at DATETIME2 DEFAULT GETUTCDATE(),
    invited_by UNIQUEIDENTIFIER REFERENCES users(id),
    is_suspended BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT uq_tenant_user UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_members_user ON tenant_members(user_id);
CREATE INDEX idx_members_role ON tenant_members(role);

-- ============================================
-- Invitations Table
-- ============================================
CREATE TABLE invitations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    tenant_id UNIQUEIDENTIFIER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
    status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    invited_by UNIQUEIDENTIFIER NOT NULL REFERENCES users(id),
    token NVARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);

-- ============================================
-- Notes Table
-- ============================================
CREATE TABLE notes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    tenant_id UNIQUEIDENTIFIER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title NVARCHAR(500) NOT NULL,
    content NVARCHAR(MAX), -- Rich text / Markdown
    created_by UNIQUEIDENTIFIER NOT NULL REFERENCES users(id),
    last_modified_by UNIQUEIDENTIFIER NOT NULL REFERENCES users(id),
    is_deleted BIT DEFAULT 0,
    deleted_at DATETIME2,
    deleted_by UNIQUEIDENTIFIER REFERENCES users(id),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX idx_notes_tenant ON notes(tenant_id);
CREATE INDEX idx_notes_created_by ON notes(created_by);
CREATE INDEX idx_notes_deleted ON notes(is_deleted);
CREATE INDEX idx_notes_title ON notes(title);

-- Full-text search on notes (optional)
-- CREATE FULLTEXT INDEX ON notes(title, content);

-- ============================================
-- Attachments Table
-- ============================================
CREATE TABLE attachments (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    tenant_id UNIQUEIDENTIFIER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    note_id UNIQUEIDENTIFIER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    file_name NVARCHAR(255) NOT NULL, -- Storage file name
    original_name NVARCHAR(255) NOT NULL, -- Original upload name
    mime_type NVARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    blob_url NVARCHAR(500) NOT NULL, -- Azure Blob Storage URL
    uploaded_by UNIQUEIDENTIFIER NOT NULL REFERENCES users(id),
    is_deleted BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX idx_attachments_tenant ON attachments(tenant_id);
CREATE INDEX idx_attachments_note ON attachments(note_id);

-- ============================================
-- Audit Logs Table
-- ============================================
CREATE TABLE audit_logs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    tenant_id UNIQUEIDENTIFIER REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UNIQUEIDENTIFIER REFERENCES users(id) ON DELETE SET NULL,
    action NVARCHAR(100) NOT NULL,
    resource_type NVARCHAR(50) NOT NULL,
    resource_id NVARCHAR(100),
    details NVARCHAR(MAX), -- JSON for additional details
    ip_address NVARCHAR(50),
    user_agent NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ============================================
-- Refresh Tokens Table (for auth)
-- ============================================
CREATE TABLE refresh_tokens (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash NVARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME2 NOT NULL,
    revoked_at DATETIME2,
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_token ON refresh_tokens(token_hash);

-- ============================================
-- Views for Common Queries
-- ============================================

-- View: Tenant members with user details
CREATE VIEW vw_tenant_members AS
SELECT 
    tm.id,
    tm.tenant_id,
    tm.user_id,
    tm.role,
    tm.joined_at,
    tm.is_suspended,
    u.email,
    u.name,
    u.avatar_url,
    t.name as tenant_name,
    t.slug as tenant_slug
FROM tenant_members tm
JOIN users u ON tm.user_id = u.id
JOIN tenants t ON tm.tenant_id = t.id
WHERE t.status = 'active';

-- View: Notes with author details
CREATE VIEW vw_notes_with_authors AS
SELECT 
    n.id,
    n.tenant_id,
    n.title,
    n.content,
    n.is_deleted,
    n.created_at,
    n.updated_at,
    creator.id as creator_id,
    creator.name as creator_name,
    creator.email as creator_email,
    editor.id as editor_id,
    editor.name as editor_name
FROM notes n
JOIN users creator ON n.created_by = creator.id
JOIN users editor ON n.last_modified_by = editor.id;

-- ============================================
-- Stored Procedures
-- ============================================

-- Procedure: Get user's tenants with roles
GO
CREATE PROCEDURE sp_get_user_tenants
    @user_id UNIQUEIDENTIFIER
AS
BEGIN
    SELECT 
        t.id,
        t.name,
        t.slug,
        t.logo_url,
        t.status,
        tm.role,
        tm.joined_at,
        (SELECT COUNT(*) FROM tenant_members WHERE tenant_id = t.id AND is_suspended = 0) as member_count
    FROM tenants t
    JOIN tenant_members tm ON t.id = tm.tenant_id
    WHERE tm.user_id = @user_id
        AND tm.is_suspended = 0
        AND t.status = 'active'
    ORDER BY tm.joined_at DESC;
END;
GO

-- Procedure: Create new tenant with owner
CREATE PROCEDURE sp_create_tenant
    @name NVARCHAR(255),
    @slug NVARCHAR(100),
    @owner_id UNIQUEIDENTIFIER,
    @tenant_id UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
    SET @tenant_id = NEWID();
    
    BEGIN TRANSACTION;
    
    -- Create tenant
    INSERT INTO tenants (id, name, slug, owner_id)
    VALUES (@tenant_id, @name, @slug, @owner_id);
    
    -- Add owner as member
    INSERT INTO tenant_members (tenant_id, user_id, role, invited_by)
    VALUES (@tenant_id, @owner_id, 'owner', @owner_id);
    
    COMMIT;
END;
GO

-- ============================================
-- Triggers for Updated Timestamps
-- ============================================

CREATE TRIGGER trg_users_updated ON users
AFTER UPDATE AS
BEGIN
    UPDATE users SET updated_at = GETUTCDATE()
    FROM users u
    INNER JOIN inserted i ON u.id = i.id;
END;
GO

CREATE TRIGGER trg_tenants_updated ON tenants
AFTER UPDATE AS
BEGIN
    UPDATE tenants SET updated_at = GETUTCDATE()
    FROM tenants t
    INNER JOIN inserted i ON t.id = i.id;
END;
GO

CREATE TRIGGER trg_notes_updated ON notes
AFTER UPDATE AS
BEGIN
    UPDATE notes SET updated_at = GETUTCDATE()
    FROM notes n
    INNER JOIN inserted i ON n.id = i.id;
END;
GO
