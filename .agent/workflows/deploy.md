---
description: How to deploy the Multi-Tenant SaaS application to Azure
---

# Deployment Workflow

## Prerequisites
- Azure CLI installed and logged in
- Node.js 18+ installed
- npm or yarn package manager

## Local Development

// turbo
1. Install frontend dependencies:
```bash
cd frontend && npm install
```

// turbo
2. Install backend dependencies:
```bash
cd backend && npm install
```

3. Set up environment variables:
- Copy `.env.example` to `.env` in both frontend and backend
- Fill in Azure AD B2C and database credentials

// turbo
4. Start the backend server:
```bash
cd backend && npm run dev
```

// turbo
5. Start the frontend dev server:
```bash
cd frontend && npm run dev
```

## Azure Deployment

1. Create Azure resources:
```bash
az group create --name saas-rg --location eastus
az staticwebapp create --name saas-frontend --resource-group saas-rg
az webapp create --name saas-backend --resource-group saas-rg --runtime "NODE:18-lts"
az sql server create --name saas-sql --resource-group saas-rg
az storage account create --name saasstorage --resource-group saas-rg
```

2. Configure Azure AD B2C tenant

3. Deploy frontend:
```bash
cd frontend && npm run build
az staticwebapp deploy --app-location ./dist
```

4. Deploy backend:
```bash
cd backend && npm run build
az webapp deploy --src-path ./dist
```
