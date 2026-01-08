# Multi-Tenant SaaS API Documentation

## Base URL
```
Development: http://localhost:3001/api/v1
Production: https://your-api.azurewebsites.net/api/v1
```

## Authentication
All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

For tenant-scoped endpoints, include the tenant context:
```
X-Tenant-ID: <tenant-id>
```

---

## Authentication Endpoints

### POST /auth/register
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": false
    },
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

### POST /auth/login
Authenticate an existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

### GET /auth/me
Get current user profile. **Requires authentication.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": null,
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### PUT /auth/me
Update current user profile. **Requires authentication.**

**Request Body:**
```json
{
  "name": "John Smith",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

### POST /auth/logout
Logout and invalidate tokens. **Requires authentication.**

### POST /auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

---

## Tenant Endpoints

### GET /tenants
Get all tenants for current user. **Requires authentication.**

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "tenant-uuid",
      "name": "Acme Inc",
      "slug": "acme-inc",
      "status": "active",
      "role": "owner",
      "memberCount": 5,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /tenants
Create a new tenant. **Requires authentication.**

**Request Body:**
```json
{
  "name": "New Workspace",
  "slug": "new-workspace"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "tenant": { ... },
    "membership": {
      "role": "owner"
    },
    "accessToken": "new-jwt-with-tenant-context"
  }
}
```

### GET /tenants/:tenantId
Get tenant details. **Requires authentication & membership.**

### PUT /tenants/:tenantId
Update tenant. **Requires admin+ role.**

**Request Body:**
```json
{
  "name": "Updated Name",
  "logoUrl": "https://example.com/logo.png",
  "settings": {
    "allowPublicSignup": false
  }
}
```

### DELETE /tenants/:tenantId
Delete tenant (soft delete). **Requires owner role.**

### POST /tenants/:tenantId/switch
Switch to a different tenant context. **Requires authentication & membership.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tenant": { ... },
    "role": "admin",
    "accessToken": "new-jwt-with-tenant-context"
  }
}
```

---

## Member Endpoints

All member endpoints require X-Tenant-ID header or tenant context in JWT.

### GET /members
Get all members of current tenant. **Requires viewer+ role.**

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "membership-uuid",
      "userId": "user-uuid",
      "role": "editor",
      "joinedAt": "2024-01-01T00:00:00Z",
      "isSuspended": false,
      "user": {
        "name": "Jane Doe",
        "email": "jane@example.com"
      }
    }
  ]
}
```

### POST /members/invite
Invite a new member. **Requires admin+ role.**

**Request Body:**
```json
{
  "email": "newmember@example.com",
  "role": "editor"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "invitationId": "uuid",
    "email": "newmember@example.com",
    "role": "editor",
    "expiresAt": "2024-01-08T00:00:00Z",
    "inviteLink": "/invite/token"
  }
}
```

### POST /members/invitations/:token/accept
Accept an invitation. **Requires authentication.**

### PUT /members/:memberId/role
Update member role. **Requires admin+ role.**

**Request Body:**
```json
{
  "role": "admin"
}
```

### DELETE /members/:memberId
Remove member from tenant. **Requires admin+ role or self-removal.**

### PUT /members/:memberId/suspend
Suspend a member. **Requires admin+ role.**

---

## Notes Endpoints

All notes endpoints require X-Tenant-ID header or tenant context in JWT.

### GET /notes
Get all notes for current tenant. **Requires viewer+ role.**

**Query Parameters:**
- `search` - Search in title and content
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sortBy` - Sort field (default: updatedAt)
- `sortOrder` - asc or desc (default: desc)
- `includeDeleted` - Include soft-deleted notes (default: false)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "note-uuid",
      "title": "My Note",
      "content": "<p>Note content...</p>",
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-02T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### GET /notes/:noteId
Get note details. **Requires viewer+ role.**

### POST /notes
Create a new note. **Requires editor+ role.**

**Request Body:**
```json
{
  "title": "New Note",
  "content": "<p>Initial content</p>"
}
```

### PUT /notes/:noteId
Update a note. **Requires editor+ role.**

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "<p>Updated content</p>"
}
```

### PATCH /notes/:noteId/content
Auto-save note content. **Requires editor+ role.**

**Request Body:**
```json
{
  "content": "<p>Auto-saved content</p>"
}
```

### DELETE /notes/:noteId
Delete a note (soft delete). **Requires editor+ role (own notes) or admin+ role (any).**

**Query Parameters:**
- `permanent` - If true and user is admin, permanently delete

### POST /notes/:noteId/restore
Restore a soft-deleted note. **Requires admin+ role.**

---

## Attachments Endpoints

### GET /attachments
Get attachments for a note. **Requires viewer+ role.**

**Query Parameters:**
- `noteId` - Filter by note ID

### POST /attachments
Upload attachments. **Requires editor+ role.**

**Request (multipart/form-data):**
- `noteId` - Target note ID
- `files` - Files to upload (max 5)

**Response (201):**
```json
{
  "success": true,
  "data": [
    {
      "id": "attachment-uuid",
      "noteId": "note-uuid",
      "fileName": "uuid.pdf",
      "originalName": "document.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 1024000,
      "blobUrl": "https://storage.example.com/..."
    }
  ]
}
```

### GET /attachments/:attachmentId
Get attachment with secure download URL. **Requires viewer+ role.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    ...attachment,
    "downloadUrl": "https://storage.example.com/...?sas-token",
    "expiresAt": "2024-01-01T01:00:00Z"
  }
}
```

### DELETE /attachments/:attachmentId
Delete attachment. **Requires editor+ role (own uploads) or admin+ role (any).**

---

## Health Endpoints

### GET /health
Basic health check.

### GET /health/ready
Readiness check with dependency status.

### GET /health/live
Liveness check (simple OK response).

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { }
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` - No or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `CONFLICT` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

---

## Rate Limiting

Default limits:
- 100 requests per 15 minutes per user/IP

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```
