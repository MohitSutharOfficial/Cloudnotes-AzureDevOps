# Infrastructure Deployment Guide

## Prerequisites
- Azure CLI installed (`az --version`)
- Azure subscription with appropriate permissions
- Resource group created

## Quick Start

### 1. Login to Azure
```bash
az login
az account set --subscription "Your-Subscription-Name"
```

### 2. Create Resource Group
```bash
az group create \
  --name rg-saas-prod \
  --location eastus
```

### 3. Deploy Infrastructure

**Development:**
```bash
az deployment group create \
  --resource-group rg-saas-dev \
  --template-file main.bicep \
  --parameters parameters.dev.json
```

**Production:**
```bash
az deployment group create \
  --resource-group rg-saas-prod \
  --template-file main.bicep \
  --parameters parameters.prod.json
```

### 4. Capture Outputs
```bash
az deployment group show \
  --resource-group rg-saas-prod \
  --name main \
  --query properties.outputs
```

## Resource Naming Convention

Resources follow: `{appName}-{environment}-{resourceType}-{suffix}`

Example:
- `saas-prod-api-abc123` (App Service)
- `saas-prod-sql-abc123` (SQL Server)
- `saasprodabc123` (Storage Account - no hyphens)

## Post-Deployment Steps

### 1. Configure Secrets in Key Vault
```bash
# SQL Admin Password
az keyvault secret set \
  --vault-name saas-prod-kv-abc123 \
  --name sql-admin-password \
  --value "YourSecurePassword123!"

# JWT Secret
az keyvault secret set \
  --vault-name saas-prod-kv-abc123 \
  --name jwt-secret \
  --value "$(openssl rand -base64 64)"
```

### 2. Run Database Schema
```bash
sqlcmd -S saas-prod-sql-abc123.database.windows.net \
  -d saas-prod-db \
  -U sqladmin \
  -P "YourPassword" \
  -i ../../database/schema.sql
```

### 3. Configure App Service Settings
App Service automatically references Key Vault secrets using:
```
@Microsoft.KeyVault(SecretUri=https://your-kv.vault.azure.net/secrets/jwt-secret/)
```

### 4. Get Static Web App Deployment Token
```bash
az staticwebapp secrets list \
  --name saas-prod-web-abc123 \
  --query "properties.apiKey"
```

Add to GitHub Secrets as `AZURE_STATIC_WEB_APPS_API_TOKEN`

## Cost Estimation

**Development (~$50/month):**
- App Service B1: ~$13
- SQL Basic: ~$5
- Storage: ~$1
- Static Web App Free: $0

**Production (~$200/month):**
- App Service P1v2: ~$75
- SQL S1: ~$30
- Storage with GRS: ~$5
- Static Web App Standard: ~$9
- Application Insights: ~$2

## Cleanup
```bash
az group delete --name rg-saas-prod --yes --no-wait
```
