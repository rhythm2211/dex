# Quick Health Check Script for Railway Deployment
# Replace YOUR_RAILWAY_URL with your actual Railway URL

$railwayUrl = "YOUR_RAILWAY_URL"  # Replace this!

Write-Host "Testing Railway Deployment..." -ForegroundColor Cyan
Write-Host "URL: $railwayUrl" -ForegroundColor Yellow
Write-Host ""

# Test root health endpoint
Write-Host "1. Testing /health endpoint..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$railwayUrl/health" -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""

# Test API v1 health endpoint
Write-Host "2. Testing /api/v1/health endpoint..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$railwayUrl/api/v1/health" -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response.Content
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""

# Test API docs
Write-Host "3. API Documentation available at:" -ForegroundColor Green
Write-Host "   $railwayUrl/docs" -ForegroundColor Cyan
Write-Host "   $railwayUrl/redoc" -ForegroundColor Cyan
