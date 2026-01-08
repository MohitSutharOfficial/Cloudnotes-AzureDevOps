# 🎯 FINAL DEPLOYMENT STEPS

## ✅ What's Ready

- ✅ Backend built (`backend/dist/`)
- ✅ Configuration updated for production
- ✅ JWT secrets generated
- ✅ Frontend API URL configured
- ✅ Database schema deployed to Azure SQL
- ✅ Storage Account created

---

## 🔧 STEP 1: Add App Service Environment Variables

Go to **Azure Portal** → **saas-learning-api-mohit** → **Configuration** → **Application settings**

### Add These Settings (Click "+ New application setting" for each):

```
Name: DB_SERVER
Value: saas-learning-sql-mohit.database.windows.net

Name: DB_DATABASE
Value: saas-learning-db

Name: DB_USER
Value: sqladmin

Name: DB_PASSWORD
Value: <YOUR_SQL_ADMIN_PASSWORD>

Name: DB_ENCRYPT
Value: true

Name: DB_PORT
Value: 1433

Name: JWT_SECRET
Value: 575f2bc38be84217249a48fda892c6b2fa10eed6f96b0df7398290d3100fe9a8a3ecfe7b7dea50af99442ff5fe287b27b671f6d0728bc468410426a7da413062

Name: JWT_EXPIRES_IN
Value: 15m

Name: REFRESH_TOKEN_SECRET
Value: e4bcc00212424885ad935bacb5625541b438829bb7a78566c5cc995f0380225a874255dc05a4c9d29891ca78b9e2c29ea91a18e61bea0f042ad439265eb28f0e

Name: REFRESH_TOKEN_EXPIRES_IN
Value: 7d

Name: NODE_ENV
Value: production

Name: PORT
Value: 8080

Name: CORS_ORIGIN
Value: https://salmon-sand-08e8bec1e.6.azurestaticapps.net,https://cloudenotes.mohitsuthar.me
```

### Get Storage Key First:
1. Go to **Storage Accounts** → **saaslearning**
2. Click **Access keys** (left sidebar)
3. Click **Show** next to key1
4. Copy the key value

### Then Add Storage Settings:
```
Name: AZURE_STORAGE_ACCOUNT
Value: saaslearning

Name: AZURE_STORAGE_KEY
Value: <PASTE_KEY_HERE>

Name: AZURE_STORAGE_CONTAINER
Value: attachments
```

**IMPORTANT:** Click **"Save"** button at the top!

---

## 📦 STEP 2: Deploy Backend

### Method 1: VS Code Extension (Recommended - Easiest!)

1. **Install Extension:**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for **"Azure App Service"**
   - Install it

2. **Sign In:**
   - Click Azure icon in left sidebar
   - Click "Sign in to Azure"
   - Complete authentication

3. **Deploy:**
   - Right-click on `backend` folder in Explorer
   - Select **"Deploy to Web App..."**
   - Choose **"saas-learning-api-mohit"**
   - Confirm deployment

### Method 2: Manual ZIP Upload

1. **Create ZIP file:**
   ```powershell
   cd c:\Users\Admin\Desktop\Azure\backend
   Compress-Archive -Path dist,node_modules,package.json,web.config -DestinationPath ..\backend-deploy.zip -Force
   ```

2. **Upload via Portal:**
   - Go to **App Service** → **saas-learning-api-mohit**
   - Go to **Development Tools** → **Advanced Tools** → **Go**
   - Click **Debug console** → **CMD**
   - Drag `backend-deploy.zip` to the `/site/wwwroot` folder
   - Wait for automatic extraction

### Method 3: FTP Upload

1. **Get FTP Credentials:**
   - App Service → **Deployment Center** → **FTPS credentials**
   - Copy FTP hostname, username, password

2. **Use FileZilla or any FTP client:**
   - Host: `ftps://saas-learning-api-mohit.azurewebsites.net`
   - Upload `dist/`, `node_modules/`, `package.json`, `web.config` to `/site/wwwroot`

---

## 🎨 STEP 3: Deploy Frontend

### Option A: Azure Static Web Apps CLI (Quick)

1. **Install SWA CLI:**
   ```powershell
   npm install -g @azure/static-web-apps-cli
   ```

2. **Get Deployment Token:**
   - Go to **Azure Portal** → **Static Web Apps** → your app
   - Click **"Manage deployment token"**
   - Copy the token

3. **Build and Deploy:**
   ```powershell
   cd c:\Users\Admin\Desktop\Azure\frontend
   npm install
   npm run build
   swa deploy ./dist --deployment-token <PASTE_TOKEN_HERE>
   ```

### Option B: GitHub Actions (Recommended for Continuous Deployment)

1. **Push code to GitHub:**
   ```powershell
   cd c:\Users\Admin\Desktop\Azure
   git add .
   git commit -m "Production deployment configuration"
   git push origin main
   ```

2. **Configure GitHub Secrets:**
   - Go to your GitHub repo → **Settings** → **Secrets** → **Actions**
   - Click **"New repository secret"**
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: <deployment-token-from-portal>

3. **Create workflow file:**
   Already exists in `.github/workflows/deploy-production.yml`
   Push will trigger automatic deployment

---

## 🔥 STEP 4: Create Storage Container

Before deploying, create the storage container:

1. Go to **Storage Account** → **saaslearning**
2. Click **Containers** (left sidebar, under Data storage)
3. Click **"+ Container"**
4. Name: `attachments`
5. Public access level: **Private**
6. Click **Create**

---

## 🧪 STEP 5: Test Your Deployment

### Test Backend:
Open browser or use PowerShell:
```powershell
# Health check
curl https://saas-learning-api-mohit.azurewebsites.net/api/v1/health
```

Expected response:
```json
{"status":"healthy","timestamp":"2026-01-08T..."}
```

### Test Frontend:
1. Open **https://cloudenotes.mohitsuthar.me**
2. Try to register a new account
3. Check browser console (F12) for errors

---

## 🚨 Troubleshooting

### If Backend shows "Application Error":

1. **Check Logs:**
   - App Service → **Log stream**
   - Look for errors

2. **Enable Detailed Logging:**
   - App Service → **Configuration** → **General settings**
   - Detailed error messages: **On**
   - Click **Save**

3. **Restart App Service:**
   - App Service → **Overview** → **Restart**

### If CORS Errors in Browser:

1. Verify **CORS_ORIGIN** in App Settings includes both domains
2. Restart App Service
3. Clear browser cache (Ctrl+Shift+Delete)

### If SQL Connection Fails:

1. **Check Firewall:**
   - SQL Server → **Networking** → **Firewall rules**
   - Enable **"Allow Azure services and resources to access this server"**
   - Click **Save**

2. **Verify Credentials:**
   - Double-check DB_USER, DB_PASSWORD in App Settings
   - Try connecting from local machine with same credentials

### If Storage Upload Fails:

1. Verify container "attachments" exists
2. Check AZURE_STORAGE_KEY is correct
3. Verify Storage Account allows public network access

---

## 📊 Verify Deployment Status

### Backend Deployment:
- App Service → **Deployment Center** → check deployment status
- Should show "Success (Active)"

### Frontend Deployment:
- Static Web Apps → **Environment** → **Production**
- Should show latest deployment with green checkmark

### Database:
- SQL Database → **Query editor**
- Run: `SELECT name FROM sys.tables`
- Should see 8 tables

---

## ✅ Final Checklist

- [ ] All App Service environment variables added
- [ ] Storage container "attachments" created
- [ ] SQL Server firewall allows Azure services
- [ ] Backend deployed to App Service
- [ ] Frontend deployed to Static Web App
- [ ] Health endpoint returns 200 OK
- [ ] Custom domain SSL working
- [ ] Can register new user account
- [ ] Can create and view notes

---

## 🎉 Success Criteria

When everything works, you should be able to:

1. ✅ Visit https://cloudenotes.mohitsuthar.me
2. ✅ Register a new account
3. ✅ Login successfully
4. ✅ Create a new workspace
5. ✅ Create and edit notes
6. ✅ Add team members
7. ✅ Upload attachments (after implementing file upload)

---

## 💡 Quick Commands Reference

```powershell
# Build everything
cd c:\Users\Admin\Desktop\Azure
.\deploy.ps1

# Deploy backend (after installing Azure CLI)
az webapp deploy --resource-group azureexplore --name saas-learning-api-mohit --src-path backend

# Deploy frontend (after installing SWA CLI)
cd frontend; swa deploy ./dist --deployment-token <token>

# View backend logs
az webapp log tail --name saas-learning-api-mohit --resource-group azureexplore

# Restart services
az webapp restart --name saas-learning-api-mohit --resource-group azureexplore
```

---

## 📚 Resources

- Backend URL: https://saas-learning-api-mohit.azurewebsites.net
- Frontend URL: https://cloudenotes.mohitsuthar.me
- Azure Portal: https://portal.azure.com
- Resource Group: azureexplore
- Region: Central India

---

## 🆘 Need More Help?

If you encounter issues:

1. Check **DEPLOYMENT_GUIDE.md** for detailed instructions
2. Review **IMPLEMENTATION_PLAN.md** for architecture details
3. Check App Service logs in Azure Portal
4. Verify all environment variables are set correctly
5. Ensure SQL firewall is configured properly

---

**Remember:** Your first deployment might take 5-10 minutes. Be patient! 🚀
