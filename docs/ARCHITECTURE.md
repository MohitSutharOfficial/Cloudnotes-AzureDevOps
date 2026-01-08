# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Azure Cloud                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   Azure CDN     │    │  Azure Static   │    │   Azure AD      │          │
│  │   (Global)      │────│   Web Apps      │    │   B2C           │          │
│  └─────────────────┘    │   (Frontend)    │    │ (Authentication)│          │
│                         └────────┬────────┘    └────────┬────────┘          │
│                                  │                       │                   │
│                                  │    ┌──────────────────┘                   │
│                                  │    │                                      │
│                                  ▼    ▼                                      │
│                         ┌─────────────────┐                                  │
│                         │   Azure App     │                                  │
│                         │   Service       │                                  │
│                         │   (Backend API) │                                  │
│                         └────────┬────────┘                                  │
│                                  │                                           │
│              ┌───────────────────┼───────────────────┐                       │
│              │                   │                   │                       │
│              ▼                   ▼                   ▼                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Azure SQL     │  │  Azure Blob     │  │  Azure Key      │              │
│  │   Database      │  │  Storage        │  │  Vault          │              │
│  │ (Multi-tenant)  │  │ (Files/Attach)  │  │ (Secrets)       │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│                         ┌─────────────────┐                                  │
│                         │   Application   │                                  │
│                         │   Insights      │                                  │
│                         │  (Monitoring)   │                                  │
│                         └─────────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Multi-Tenant Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                          users                                   │
├────────────────┬────────────────────────────────────────────────┤
│ id             │ UNIQUEIDENTIFIER (PK)                          │
│ email          │ NVARCHAR(255) UNIQUE                           │
│ name           │ NVARCHAR(255)                                  │
│ azure_ad_id    │ NVARCHAR(255) (Azure AD B2C Object ID)        │
│ ...            │                                                 │
└────────────────┴────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      tenant_members                              │
├────────────────┬────────────────────────────────────────────────┤
│ id             │ UNIQUEIDENTIFIER (PK)                          │
│ tenant_id      │ UNIQUEIDENTIFIER (FK → tenants)                │
│ user_id        │ UNIQUEIDENTIFIER (FK → users)                  │
│ role           │ NVARCHAR(20) [owner|admin|editor|viewer]       │
│ is_suspended   │ BIT                                            │
└────────────────┴────────────────────────────────────────────────┘
         │
         │ N:1
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         tenants                                  │
├────────────────┬────────────────────────────────────────────────┤
│ id             │ UNIQUEIDENTIFIER (PK)                          │
│ name           │ NVARCHAR(255)                                  │
│ slug           │ NVARCHAR(100) UNIQUE                           │
│ status         │ NVARCHAR(20) [active|suspended|deleted]        │
│ owner_id       │ UNIQUEIDENTIFIER (FK → users)                  │
└────────────────┴────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          notes                                   │
├────────────────┬────────────────────────────────────────────────┤
│ id             │ UNIQUEIDENTIFIER (PK)                          │
│ tenant_id      │ UNIQUEIDENTIFIER (FK → tenants)                │
│ title          │ NVARCHAR(500)                                  │
│ content        │ NVARCHAR(MAX)                                  │
│ created_by     │ UNIQUEIDENTIFIER (FK → users)                  │
│ is_deleted     │ BIT (soft delete)                              │
└────────────────┴────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       attachments                                │
├────────────────┬────────────────────────────────────────────────┤
│ id             │ UNIQUEIDENTIFIER (PK)                          │
│ tenant_id      │ UNIQUEIDENTIFIER (FK → tenants)                │
│ note_id        │ UNIQUEIDENTIFIER (FK → notes)                  │
│ blob_url       │ NVARCHAR(500)                                  │
│ ...            │                                                 │
└────────────────┴────────────────────────────────────────────────┘
```

## Role-Based Access Control (RBAC)

### Role Hierarchy

```
    ┌─────────┐
    │  OWNER  │  ← Full control, can delete tenant
    └────┬────┘
         │
    ┌────▼────┐
    │  ADMIN  │  ← Manage team, settings, all content
    └────┬────┘
         │
    ┌────▼────┐
    │ EDITOR  │  ← Create/edit own content
    └────┬────┘
         │
    ┌────▼────┐
    │ VIEWER  │  ← Read-only access
    └─────────┘
```

### Permission Matrix

| Permission          | Viewer | Editor | Admin | Owner |
|---------------------|--------|--------|-------|-------|
| View notes          | ✅     | ✅     | ✅    | ✅    |
| Create notes        | ❌     | ✅     | ✅    | ✅    |
| Edit own notes      | ❌     | ✅     | ✅    | ✅    |
| Delete own notes    | ❌     | ✅     | ✅    | ✅    |
| Delete any notes    | ❌     | ❌     | ✅    | ✅    |
| View team           | ✅     | ✅     | ✅    | ✅    |
| Invite members      | ❌     | ❌     | ✅    | ✅    |
| Remove members      | ❌     | ❌     | ✅    | ✅    |
| Change roles        | ❌     | ❌     | ✅    | ✅    |
| Manage settings     | ❌     | ❌     | ✅    | ✅    |
| Delete tenant       | ❌     | ❌     | ❌    | ✅    |
| Transfer ownership  | ❌     | ❌     | ❌    | ✅    |

## Authentication Flow

### Azure AD B2C Flow

```
┌──────────┐     ┌─────────────┐     ┌────────────┐     ┌──────────┐
│  User    │     │  Frontend   │     │  Azure AD  │     │  Backend │
│ Browser  │     │    SPA      │     │    B2C     │     │   API    │
└────┬─────┘     └──────┬──────┘     └─────┬──────┘     └────┬─────┘
     │                  │                   │                 │
     │  1. Click Login  │                   │                 │
     │─────────────────>│                   │                 │
     │                  │                   │                 │
     │                  │  2. Redirect to   │                 │
     │                  │   B2C Login Page  │                 │
     │<─────────────────│─────────────────>│                 │
     │                  │                   │                 │
     │  3. Enter creds  │                   │                 │
     │─────────────────────────────────────>│                 │
     │                  │                   │                 │
     │  4. Auth code    │                   │                 │
     │<─────────────────────────────────────│                 │
     │                  │                   │                 │
     │  5. Exchange for │                   │                 │
     │     tokens       │                   │                 │
     │─────────────────>│                   │                 │
     │                  │  6. Token request │                 │
     │                  │─────────────────>│                 │
     │                  │                   │                 │
     │                  │  7. Access +      │                 │
     │                  │     Refresh token │                 │
     │                  │<─────────────────│                 │
     │                  │                   │                 │
     │  8. Store tokens │                   │                 │
     │                  │                   │                 │
     │                  │  9. API call with │                 │
     │                  │     Bearer token  │                 │
     │                  │─────────────────────────────────────>│
     │                  │                   │                 │
     │                  │                   │  10. Validate   │
     │                  │                   │      token      │
     │                  │                   │<────────────────│
     │                  │                   │                 │
     │                  │  11. API response │                 │
     │                  │<─────────────────────────────────────│
     │                  │                   │                 │
```

## Tenant Isolation

### Data Isolation Strategies

1. **Row-Level Security**: Every table includes `tenant_id` column
2. **Query Filtering**: All queries include tenant context
3. **Middleware Enforcement**: Tenant validated on every request
4. **Storage Isolation**: Blob containers organized by tenant ID

### Request Flow with Tenant Context

```
┌──────────────────────────────────────────────────────────────────┐
│                      API Request                                  │
│  Authorization: Bearer <jwt with tenant_id claim>                │
│  X-Tenant-ID: optional override                                  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Auth Middleware                                 │
│  1. Validate JWT signature                                        │
│  2. Extract user claims                                           │
│  3. Check token expiration                                        │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Tenant Middleware                                │
│  1. Extract tenant from header OR JWT                             │
│  2. Verify user membership in tenant                              │
│  3. Load user's role for this tenant                              │
│  4. Attach tenant context to request                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                   RBAC Middleware                                 │
│  1. Check required permission for endpoint                        │
│  2. Verify user's role has permission                             │
│  3. Allow or deny request                                         │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Business Logic                                   │
│  - All queries automatically filtered by tenant_id               │
│  - User can only access their tenant's data                       │
└──────────────────────────────────────────────────────────────────┘
```

## Security Considerations

### Defense in Depth

1. **Network Layer**: Azure Private Endpoints, NSGs
2. **Application Layer**: CORS, Helmet security headers
3. **Authentication**: Azure AD B2C with MFA
4. **Authorization**: RBAC on every endpoint
5. **Data Layer**: Tenant isolation, encryption at rest

### Security Checklist

- [x] HTTPS enforced (Azure defaults)
- [x] Secure headers via Helmet
- [x] CORS properly configured
- [x] JWT validation on all protected routes
- [x] Tenant boundary enforcement
- [x] Role-based permission checking
- [x] Rate limiting
- [x] Input validation
- [x] SQL injection prevention (parameterized queries)
- [x] Soft delete for data recovery
- [x] Audit logging ready

## Scalability

### Current Architecture Supports

- **Horizontal Scaling**: Stateless API servers
- **Database Scaling**: Azure SQL elastic pools
- **Storage Scaling**: Azure Blob (virtually unlimited)
- **CDN Caching**: Static assets globally distributed

### Future Scaling Options

- **Multi-Region**: Active-active deployment
- **Sharding**: Per-tenant database isolation
- **Caching**: Redis for hot data
- **Queue Processing**: Azure Service Bus for async tasks
