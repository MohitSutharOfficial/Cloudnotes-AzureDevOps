// Bicep template for Multi-Tenant SaaS Infrastructure
@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Unique suffix for resource naming')
param resourceSuffix string = uniqueString(resourceGroup().id)

// Variables
var appName = 'saas-${environment}'
var appServicePlanName = '${appName}-plan-${resourceSuffix}'
var webAppName = '${appName}-api-${resourceSuffix}'
var staticWebAppName = '${appName}-web-${resourceSuffix}'
var sqlServerName = '${appName}-sql-${resourceSuffix}'
var sqlDatabaseName = '${appName}-db'
var storageAccountName = 'saas${environment}${resourceSuffix}'
var keyVaultName = '${appName}-kv-${resourceSuffix}'
var appInsightsName = '${appName}-insights-${resourceSuffix}'

// SKU configurations per environment
var skuConfig = {
  dev: {
    appServicePlan: 'B1'
    sqlDatabase: 'Basic'
    storage: 'Standard_LRS'
  }
  staging: {
    appServicePlan: 'S1'
    sqlDatabase: 'S0'
    storage: 'Standard_GRS'
  }
  prod: {
    appServicePlan: 'P1v2'
    sqlDatabase: 'S1'
    storage: 'Standard_GRS'
  }
}

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: skuConfig[environment].appServicePlan
  }
  properties: {
    reserved: false // false for Windows, true for Linux
  }
  tags: {
    environment: environment
    project: 'multi-tenant-saas'
  }
}

// Backend API App Service
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      nodeVersion: '~18'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'DB_HOST'
          value: sqlServer.properties.fullyQualifiedDomainName
        }
        {
          name: 'DB_NAME'
          value: sqlDatabaseName
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_NAME'
          value: storageAccount.name
        }
      ]
      cors: {
        allowedOrigins: [
          'https://${staticWebAppName}.azurestaticapps.net'
        ]
        supportCredentials: true
      }
    }
  }
  tags: {
    environment: environment
    project: 'multi-tenant-saas'
  }
}

// Static Web App (Frontend)
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/frontend'
      outputLocation: 'dist'
    }
  }
  tags: {
    environment: environment
    project: 'multi-tenant-saas'
  }
}

// Azure SQL Server
resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: 'sqladmin'
    administratorLoginPassword: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/sql-admin-password/)'
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
  tags: {
    environment: environment
    project: 'multi-tenant-saas'
  }
}

// SQL Database
resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  sku: {
    name: skuConfig[environment].sqlDatabase
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: environment == 'prod' ? 107374182400 : 2147483648 // 100GB prod, 2GB dev
  }
  tags: {
    environment: environment
    project: 'multi-tenant-saas'
  }
}

// SQL Firewall Rule - Allow Azure Services
resource sqlFirewallRule 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: skuConfig[environment].storage
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    encryption: {
      services: {
        blob: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
  tags: {
    environment: environment
    project: 'multi-tenant-saas'
  }
}

// Blob Container for Attachments
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  parent: storageAccount
  name: 'default'
}

resource attachmentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  parent: blobService
  name: 'attachments'
  properties: {
    publicAccess: 'None'
  }
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    accessPolicies: []
  }
  tags: {
    environment: environment
    project: 'multi-tenant-saas'
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: environment == 'prod' ? 90 : 30
  }
  tags: {
    environment: environment
    project: 'multi-tenant-saas'
  }
}

// Outputs
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output storageAccountName string = storageAccount.name
output keyVaultName string = keyVault.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
