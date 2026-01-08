# Copilot Instructions — Multi-Tenant SaaS Platform

You are assisting on a **production-grade, multi-tenant SaaS platform**.
All code must be **secure, tenant-isolated, role-aware, Azure-ready, and production-safe**.

---

## Project Overview
- Frontend: React + Vite → Azure Static Web Apps
- Backend: Node.js + Express + TypeScript → Azure App Service
- Database: Azure SQL (SQL Server)
- Storage: Azure Blob Storage
- Auth: Azure AD B2C (preferred), JWT fallback supported
- Architecture: Single codebase, multi-tenant, strict RBAC

---

## Architecture Essentials

### Multi-Tenancy Model (MANDATORY)
- All tenant-scoped operations MUST include `tenantId` (`UNIQUEIDENTIFIER`)
- Tenant resolution order (server-side only):
  1. URL parameter
  2. `X-Tenant-ID` request header
  3. JWT claim
- Client-provided tenant context is NEVER trusted without server validation
- All tenant-scoped tables include `tenant_id UNIQUEIDENTIFIER`
- Data isolation is enforced at **application level** (SQL Server RLS optional as defense-in-depth)

Reference: `backend/src/middleware/tenant.ts`

---

### RBAC Hierarchy
Role levels (highest → lowest):
- OWNER (4)
- ADMIN (3)
- EDITOR (2)
- VIEWER (1)

Rules:
- Prefer `requireMinRole(Role.EDITOR)` for hierarchical access
- Use permission-based checks only for exceptional actions
- RBAC enforcement MUST be server-side

Reference:
- `backend/src/middleware/rbac.ts`
- `backend/src/types/index.ts`

---

### Authentication Flow (SECURITY FIRST)
- Access tokens: short-lived JWT
- Refresh tokens: **httpOnly, Secure cookies (recommended)**
- `localStorage` token usage is allowed only as a fallback with XSS protections
- Frontend auto-refreshes tokens on 401
- Backend validates JWT via `authenticate` middleware
- Tenant membership is validated server-side

Frontend reference: `frontend/src/services/api.ts`

---

## Development Patterns

### Backend Route Structure (REQUIRED)
```ts
router.post(
  '/',
  authenticate,
  requireTenant,
  requireMinRole(Role.EDITOR),
  asyncHandler(async (req, res) => {
    if (!req.user || !req.tenantId) throw new UnauthorizedError();

    const tenantId = req.tenantId;
    const userId = req.user.id;

    // Tenant-scoped queries only
  })
);
