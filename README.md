# Multi-Tenant SaaS Platform

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18%2B-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Azure](https://img.shields.io/badge/Azure-Ready-0089D6.svg)

**A secure, scalable multi-tenant SaaS application for notes, files, and team collaboration.**

[Features](#features) • [Quick Start](#quick-start) • [Architecture](#architecture) • [API Docs](#api-documentation) • [Deployment](#deployment)

</div>

---

## 🚀 Overview

This is a production-ready multi-tenant SaaS platform built with modern technologies and Azure cloud services. Users can create organizations (tenants), invite team members with different roles, manage notes with rich text editing, and upload files securely.

### Key Highlights

- **🏢 Multi-Tenant Architecture**: Complete data isolation between organizations
- **🔐 Enterprise Security**: Azure AD B2C authentication, RBAC, secure by default
- **📝 Rich Content Management**: Notes with markdown/rich text and file attachments
- **👥 Team Collaboration**: Role-based access (Owner, Admin, Editor, Viewer)
- **☁️ Azure-Ready**: Designed for Azure Static Web Apps, App Service, SQL, and Blob Storage

---

## ✨ Features

### Authentication & Security
- Azure AD B2C integration (SSO ready)
- JWT-based session management
- Password policies with strength validation
- Secure token refresh handling

### Tenant Management
- Create unlimited workspaces
- Unique URLs per workspace
- Tenant-scoped settings
- One user → multiple tenants support

### Role-Based Access Control
| Role | Permissions |
|------|-------------|
| **Owner** | Full control, delete workspace, transfer ownership |
| **Admin** | Manage team, settings, all content |
| **Editor** | Create and edit own content |
| **Viewer** | Read-only access |

### Notes & Content
- Rich text editor (TipTap)
- Auto-save functionality
- Search and filtering
- Soft delete with restore
- File attachments

### File Management
- Drag-and-drop upload
- Type and size validation
- Secure Azure Blob Storage
- Temporary download links

---

## 🏗️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for blazing fast development
- **React Router** for navigation
- **Zustand** for state management
- **TanStack Query** for server state
- **Lucide React** for icons
- **TipTap** for rich text editing

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **JWT** for authentication
- **Multer** for file uploads
- **Azure SDK** for cloud services

### Database
- **Azure SQL** / SQL Server compatible
- Row-level tenant isolation
- Optimized indexes

### Cloud (Azure)
- Static Web Apps (Frontend)
- App Service (Backend)
- SQL Database
- Blob Storage
- Key Vault
- Application Insights

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Azure account (for deployment)

### Local Development

1. **Clone the repository**
```bash
git clone <repo-url>
cd Azure
```

2. **Install frontend dependencies**
```bash
cd frontend
npm install
```

3. **Install backend dependencies**
```bash
cd ../backend
npm install
```

4. **Configure environment**
```bash
# Backend
cp .env.example .env
# Edit .env with your settings
```

5. **Start development servers**

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

6. **Open the app**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api/v1

---

## 📁 Project Structure

```
Azure/
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Page components
│   │   ├── stores/           # Zustand stores
│   │   ├── services/         # API client
│   │   └── types/            # TypeScript types
│   └── index.html
│
├── backend/                  # Express API
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   ├── middleware/       # Auth, RBAC, error handling
│   │   ├── types/            # TypeScript types
│   │   └── config/           # Configuration
│   └── package.json
│
├── database/                 # SQL schema
│   └── schema.sql
│
├── docs/                     # Documentation
│   ├── API.md
│   └── ARCHITECTURE.md
│
└── infrastructure/           # IaC templates
```

---

## 📖 API Documentation

See [docs/API.md](docs/API.md) for complete API reference.

### Quick Examples

**Register a user:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123", "name": "John Doe"}'
```

**Create a workspace:**
```bash
curl -X POST http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workspace"}'
```

---

## 🏛️ Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

### High-Level Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────>│   Backend   │────>│  Database   │
│  React SPA  │     │ Express API │     │  Azure SQL  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │ Azure Blob  │
                    │  Storage    │
                    └─────────────┘
```

---

## 🚢 Deployment

### Azure Deployment

1. **Create Azure resources:**
```bash
az group create --name saas-rg --location eastus

# Static Web App for frontend
az staticwebapp create --name saas-frontend -g saas-rg

# App Service for backend
az appservice plan create -n saas-plan -g saas-rg --sku B1 --is-linux
az webapp create -n saas-backend -g saas-rg -p saas-plan --runtime "NODE:18-lts"

# SQL Database
az sql server create -n saas-sql -g saas-rg -u adminuser -p <password>
az sql db create -n saas-db -s saas-sql -g saas-rg --tier Basic

# Storage Account
az storage account create -n saasstorage -g saas-rg --sku Standard_LRS
```

2. **Configure GitHub Actions** for CI/CD

3. **Set up Azure AD B2C** for authentication

---

## 🔐 Security

- All endpoints use HTTPS
- JWT tokens with short expiration
- Rate limiting (100 req/15min)
- CORS protection
- Helmet security headers
- SQL injection prevention
- Tenant boundary enforcement

---

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

---

## 📊 Monitoring

- **Application Insights** for APM
- **Health endpoints** for uptime monitoring
- **Structured logging** for debugging
- **Error tracking** with stack traces

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/)
- Styled with custom CSS design system
- Icons by [Lucide](https://lucide.dev/)
- Editor by [TipTap](https://tiptap.dev/)
- Powered by [Azure](https://azure.microsoft.com/)

---

<div align="center">

**Made with ❤️ for modern SaaS development**

</div>
