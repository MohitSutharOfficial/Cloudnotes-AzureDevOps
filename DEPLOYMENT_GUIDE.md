# 🚀 Production Deployment Guide

## ✅ Azure Resources (Created)

- **Resource Group:** azureexplore (Central India)
- **Storage Account:** saaslearning
- **SQL Server:** saas-learning-sql-mohit.database.windows.net
- **SQL Database:** saas-learning-db
- **App Service:** saas-learning-api-mohit.azurewebsites.net
- **Static Web App:** cloudenotes.mohitsuthar.me

---

## 🔧 Step 1: Configure App Service Environment Variables

Go to **Azure Portal** → **App Services** → **saas-learning-api-mohit** → **Configuration** → **Application settings**

Add these **EXACT** settings (click "+ New application setting" for each):

### Database Settings
```
DB_SERVER=saas-learning-sql-mohit.database.windows.net
DB_DATABASE=saas-learning-db
DB_USER=sqladmin
DB_PASSWORD=<your-sql-admin-password>
DB_ENCRYPT=true
DB_PORT=1433
```

### JWT Secrets (Generated)
```
JWT_SECRET=575f2bc38be84217249a48fda892c6b2fa10eed6f96b0df7398290d3100fe9a8a3ecfe7b7dea50af99442ff5fe287b27b671f6d0728bc468410426a7da413062
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=e4bcc00212424885ad935bacb5625541b438829bb7a78566c5cc995f0380225a874255dc05a4c9d29891ca78b9e2c29ea91a18e61bea0f042ad439265eb28f0e
REFRESH_TOKEN_EXPIRES_IN=7d
```

### Storage Settings
```
AZURE_STORAGE_ACCOUNT=saaslearning
AZURE_STORAGE_KEY=<get-from-storage-account-access-keys>
AZURE_STORAGE_CONTAINER=attachments
```

### App Settings
```
NODE_ENV=production
PORT=8080
CORS_ORIGIN=https://salmon-sand-08e8bec1e.6.azurestaticapps.net,https://cloudenotes.mohitsuthar.me
```

### Optional (Later)
```
APPLICATIONINSIGHTS_CONNECTION_STRING=<from-app-insights>
```

**IMPORTANT:** Click **"Save"** at the top after adding all settings!

---

## 📦 Step 2: Deploy Backend to App Service

### Option A: Manual Deployment (Recommended for First Time)

1. **Build the backend:**
```powershell
cd backend
npm install
npm run build
```

2. **Create deployment package:**
```powershell
# Create a zip file with dist, node_modules, and package.json
Compress-Archive -Path dist,node_modules,package.json -DestinationPath ../backend-deploy.zip -Force
```

3. **Deploy via Azure Portal:**
   - Go to App Service → **Deployment Center**
   - Click **"Manual Deployment (Push/FTP)"**
   - Use **Local Git** or **FTP/Credentials**
   - Or use **"Deploy ZIP file"** option

### Option B: Deploy via VS Code (Easiest)

1. Install **Azure App Service extension** in VS Code
2. Right-click on App Service in Azure sidebar
3. Select **"Deploy to Web App"**
4. Choose the `backend` folder

### Option C: Deploy via Azure CLI
```powershell
az webapp deployment source config-zip `
  --resource-group azureexplore `
  --name saas-learning-api-mohit `
  --src backend-deploy.zip
```

---

## 🎨 Step 3: Deploy Frontend to Static Web Apps

### Option A: GitHub Integration (Recommended)

1. Push your code to GitHub (if not already done)
2. Go to **Static Web Apps** → **cloudenotes**
3. Click **"Manage deployment token"** → Copy token
4. Add GitHub Actions secrets:
   - Go to GitHub repo → **Settings** → **Secrets** → **Actions**
   - Add: `AZURE_STATIC_WEB_APPS_API_TOKEN` = <deployment-token>

5. Create GitHub Actions workflow (already exists in `.github/workflows/`)

6. Push to trigger deployment:
```powershell
git add .
git commit -m "Production configuration"
git push origin main
```

### Option B: Manual Deployment via CLI

```powershell
cd frontend
npm install
npm run build

# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist --deployment-token <your-token>
```

---

## 🧪 Step 4: Test Your Deployment

### Test Backend API:
```powershell
# Health check
curl https://saas-learning-api-mohit.azurewebsites.net/api/v1/health

# Should return: {"status":"healthy","timestamp":"..."}
```

### Test Frontend:
1. Open https://cloudenotes.mohitsuthar.me
2. Try to register a new account
3. Check browser console for errors

---

## 🔍 Step 5: Verify Database Connection

1. Go to App Service → **Log stream**
2. Watch for connection logs
3. Check for any SQL connection errors

If errors occur:
- Verify SQL firewall allows Azure services
- Check DB credentials in App Settings
- Ensure DB is not paused

---

## 🚨 Common Issues & Fixes

### Issue: "Application Error" on App Service
**Fix:** Check App Service → **Logs** → **App Service logs** (Enable)
- Application Logging: File System
- Level: Error
- Then check **Log stream**

### Issue: CORS errors in browser
**Fix:** Update CORS_ORIGIN in App Settings to include both domains

### Issue: Frontend can't reach backend
**Fix:** Check `api.ts` has correct API_BASE_URL

### Issue: SQL connection timeout
**Fix:** 
- SQL Server → **Firewall** → Enable "Allow Azure services"
- Check connection string format

---

## 📊 Monitor Your Application

### Enable Application Insights (Optional - Free tier):
1. Create Application Insights resource
2. Copy connection string
3. Add to App Service settings: `APPLICATIONINSIGHTS_CONNECTION_STRING`
4. Restart App Service

---

## 💰 Cost Breakdown

- SQL Database (Basic 5 DTU): ~$5/month
- App Service (B1 Basic): ~$13/month
- Static Web Apps (Free tier): $0
- Storage Account (LRS): <$1/month
- **Total: ~$19/month** (within your $48 budget)

---

## ✅ Final Checklist

- [ ] All App Service settings configured
- [ ] Storage container "attachments" created
- [ ] SQL firewall allows Azure services
- [ ] Backend deployed and health endpoint working
- [ ] Frontend built and deployed
- [ ] Custom domain SSL working
- [ ] Registration/login tested
- [ ] CORS configured correctly

---

## 🆘 Need Help?

If deployment fails, check:
1. App Service **Deployment Center** → **Logs**
2. App Service **Log stream**
3. Browser **Developer Console** (F12)
4. SQL Server **Firewall rules**
