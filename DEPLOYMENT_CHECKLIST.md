# Production Deployment Checklist

## Pre-Deployment

### Security
- [ ] All secrets moved to Azure Key Vault
- [ ] `.env` files added to `.gitignore` (verify not committed)
- [ ] JWT secret generated with `openssl rand -base64 64`
- [ ] SQL admin password is strong (16+ chars, mixed case, symbols)
- [ ] CORS origins updated for production domains
- [ ] Rate limiting configured appropriately

### Infrastructure
- [ ] Azure resources provisioned via Bicep
- [ ] Resource group created for environment
- [ ] Key Vault configured with RBAC
- [ ] Application Insights enabled
- [ ] SQL firewall rules configured
- [ ] Storage account private access enabled

### Database
- [ ] Schema deployed to Azure SQL
- [ ] Connection string tested from App Service
- [ ] Backup policy configured
- [ ] Migration strategy in place

### Code
- [ ] All tests passing locally
- [ ] TypeScript builds without errors
- [ ] Frontend builds successfully
- [ ] Backend builds successfully
- [ ] No console.log in production code (use logger)
- [ ] Environment variables documented

### GitHub Actions
- [ ] Secrets configured in GitHub:
  - `AZURE_WEBAPP_PUBLISH_PROFILE`
  - `AZURE_STATIC_WEB_APPS_API_TOKEN`
  - `PRODUCTION_API_URL`
- [ ] CI pipeline passing on main branch
- [ ] Deploy workflow tested on staging

## Deployment

### Backend (App Service)
- [ ] Code deployed via GitHub Actions
- [ ] Environment variables configured in App Service
- [ ] Health check endpoint responding: `/api/v1/health`
- [ ] Application Insights logging active
- [ ] Logs verified in App Service logs

### Frontend (Static Web Apps)
- [ ] Built with production API URL
- [ ] Deployed via GitHub Actions
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] staticwebapp.config.json routes working

### Database
- [ ] Connection pooling configured
- [ ] Indexes created per schema
- [ ] Query performance tested
- [ ] Backup verified

## Post-Deployment

### Verification
- [ ] Production URL accessible
- [ ] Can register new user
- [ ] Can login
- [ ] Can create tenant
- [ ] Can create notes
- [ ] Can upload files
- [ ] CORS working from frontend
- [ ] API response times acceptable (<200ms p95)

### Monitoring
- [ ] Application Insights dashboard configured
- [ ] Alerts set up for:
  - 5xx errors > 5 in 5 minutes
  - Response time > 2 seconds
  - Dependency failures
  - Exception rate spike
- [ ] Log retention configured (30-90 days)
- [ ] Availability tests configured

### Documentation
- [ ] Deployment runbook updated
- [ ] API documentation published
- [ ] Architecture diagrams current
- [ ] Incident response plan documented

## Rollback Plan

If deployment fails:
```bash
# Rollback App Service
az webapp deployment slot swap \
  --resource-group rg-saas-prod \
  --name saas-prod-api \
  --slot staging \
  --target-slot production

# Rollback Static Web App
# Use GitHub Actions to redeploy previous commit
```

## Performance Baseline

Capture after first production deployment:
- [ ] Average response time: _____ ms
- [ ] Requests per second: _____
- [ ] Error rate: _____ %
- [ ] Database connections: _____
- [ ] Memory usage: _____ MB
- [ ] CPU usage: _____ %

## Next Steps After Deployment

1. Monitor logs for 24 hours
2. Run load tests
3. Enable auto-scaling if needed
4. Set up CDN for static assets
5. Configure custom domain with SSL
6. Enable Azure Front Door (if global)
7. Set up disaster recovery
