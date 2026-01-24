# Post-Deployment Verification Steps

## 1. Get Your Railway URL
- Go to Railway Dashboard → Your Service → Settings → Networking
- Copy the Public Domain URL (e.g., `https://your-app.up.railway.app`)

## 2. Test Health Endpoint

### Using curl (PowerShell/Command Prompt):
```bash
curl https://YOUR_RAILWAY_URL/health
```

### Using PowerShell (Invoke-WebRequest):
```powershell
Invoke-WebRequest -Uri "https://YOUR_RAILWAY_URL/health" | Select-Object -ExpandProperty Content
```

### Using Browser:
Open in browser: `https://YOUR_RAILWAY_URL/health`

**Expected Response:**
```json
{
  "status": "active",
  "version": "1.3.0",
  "environment": "production",
  "postgres": "connected",
  "neo4j": "connected"
}
```

## 3. Test API Endpoints

### Health Check (API v1):
```bash
curl https://YOUR_RAILWAY_URL/api/v1/health
```

### Check API Documentation:
```bash
# Open in browser
https://YOUR_RAILWAY_URL/docs
```

## 4. Check Railway Logs

In Railway Dashboard:
- Go to your service → **Deployments** tab
- Click on the latest deployment
- Check **Logs** tab for any errors

## 5. Verify Environment Variables

In Railway Dashboard:
- Go to **Variables** tab
- Verify all required variables are set:
  - `POSTGRES_HOST`
  - `POSTGRES_PASSWORD`
  - `NEO4J_URI`
  - `NEO4J_PASSWORD`
  - `GROQ_API_KEY`
  - `BACKEND_CORS_ORIGINS`
  - `FRONTEND_URL`

## 6. Test RAG Service (if applicable)

```bash
curl -X POST https://YOUR_RAILWAY_URL/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'
```

## 7. Monitor Resource Usage

In Railway Dashboard:
- Check **Metrics** tab
- Verify CPU/Memory usage is reasonable
- Check if the optimized build reduced image size

## Common Issues to Check:

1. **Health endpoint returns 503**: Database connections might be failing
2. **CORS errors**: Verify `BACKEND_CORS_ORIGINS` includes your frontend URL
3. **Timeout errors**: Check if all services are responding
4. **Import errors**: Check logs for missing dependencies
