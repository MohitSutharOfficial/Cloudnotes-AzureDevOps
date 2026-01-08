# ⚡ Quick Deployment Script

Write-Host "🚀 Starting Deployment Process..." -ForegroundColor Cyan

# Step 1: Build Backend
Write-Host "`n📦 Building Backend..." -ForegroundColor Yellow
cd backend
npm install
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backend built successfully!" -ForegroundColor Green

# Step 2: Build Frontend
Write-Host "`n📦 Building Frontend..." -ForegroundColor Yellow
cd ../frontend
npm install
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Frontend built successfully!" -ForegroundColor Green

cd ..

Write-Host "`n✅ All builds completed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Deploy backend: Right-click 'backend' folder in VS Code Azure extension → 'Deploy to Web App'" -ForegroundColor White
Write-Host "2. Deploy frontend: cd frontend; swa deploy ./dist --deployment-token <token>" -ForegroundColor White
Write-Host "`nOr see DEPLOYMENT_GUIDE.md for detailed instructions" -ForegroundColor Yellow
