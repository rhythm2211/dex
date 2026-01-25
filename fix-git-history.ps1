# Script to fix git history by removing secrets from commit 514f151
# Run this in PowerShell from the project root

Write-Host "Fixing git history to remove secrets..." -ForegroundColor Yellow

# Step 1: Reset to before the problematic commit (keeps changes in working directory)
Write-Host "`nStep 1: Resetting to commit before secrets..." -ForegroundColor Cyan
git reset --soft 09c2be4

# Step 2: Unstage all files
Write-Host "`nStep 2: Unstaging files..." -ForegroundColor Cyan
git reset HEAD .

# Step 3: Remove the problematic file if it exists
Write-Host "`nStep 3: Removing RAILWAY_ENV_VARS.txt if it exists..." -ForegroundColor Cyan
if (Test-Path "frontend/RAILWAY_ENV_VARS.txt") {
    Remove-Item "frontend/RAILWAY_ENV_VARS.txt" -Force
    Write-Host "Removed frontend/RAILWAY_ENV_VARS.txt" -ForegroundColor Green
}

# Step 4: Stage only the files we want (without secrets)
Write-Host "`nStep 4: Staging fixed files..." -ForegroundColor Cyan
git add frontend/railway.json
git add frontend/Dockerfile
git add FRONTEND_DEPLOYMENT.md
git add FRONTEND_DEPLOYMENT_CHECKLIST.md
git add NEXT_STEPS.md

# Step 5: Create a new commit without secrets
Write-Host "`nStep 5: Creating new commit without secrets..." -ForegroundColor Cyan
git commit -m "Added frontend deployment configuration (secrets removed)"

Write-Host "`n✅ Done! History has been rewritten." -ForegroundColor Green
Write-Host "`nNow you can push with: git push origin dev --force" -ForegroundColor Yellow
Write-Host "⚠️  Note: --force is needed because we rewrote history" -ForegroundColor Yellow
