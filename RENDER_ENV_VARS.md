# Render Environment Variables

**⚠️ IMPORTANT**: The `render.yaml` file uses `sync: false` for sensitive variables to prevent committing secrets to git. You MUST set these manually in Render Dashboard.

## Required Environment Variables for Render

After creating your Render service from `render.yaml`, go to **Environment** tab and add these variables:

### Copy-Paste Ready (for Render Dashboard)

**⚠️ CRITICAL**: The error shows port 5432 is being used instead of 6543. Make sure `POSTGRES_PORT=6543` is set!

```env
POSTGRES_HOST=db.zyrxhllgdgowsbjislaq.supabase.co
POSTGRES_PORT=6543
POSTGRES_PASSWORD=[@Muj219302335]
GROQ_API_KEY=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
GITHUB_TOKEN=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
NEO4J_URI=neo4j+s://f5c2d367.databases.neo4j.io
NEO4J_PASSWORD=N4jbHcSTHB8hVu5js2KHKuadLosl6Y0YpLoIZ2oSNhw
```

**Important**: 
- `POSTGRES_PORT=6543` is CRITICAL - connection pooler works better with Render
- If you see port 5432 in errors, `POSTGRES_PORT` is not set correctly in Render Dashboard

### Variables Already Set in render.yaml

These are already configured in `render.yaml` and should be set automatically:
- `ENVIRONMENT=production`
- `DEBUG=false`
- `POSTGRES_PORT=6543` ← **Verify this is set!**
- `POSTGRES_USER=postgres`
- `POSTGRES_DB=postgres`
- `POSTGRES_VECTOR_TABLE=document_vectors`
- `NEO4J_USERNAME=neo4j`
- `NEO4J_DATABASE=neo4j`
- `BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in"]`
- `FRONTEND_URL=https://dex.net.in`

**Note**: If `POSTGRES_PORT` is not working from render.yaml, set it manually in Render Dashboard.

## How to Add Variables in Render

1. Go to Render Dashboard → Your Service (`dex-backend`)
2. Click **Environment** tab
3. Click **Add Environment Variable** for each variable above
4. Enter the key and value
5. Click **Save Changes**
6. Service will automatically redeploy

## Why sync: false?

The `render.yaml` uses `sync: false` for sensitive variables to:
- ✅ Prevent committing secrets to git (GitHub push protection)
- ✅ Keep secrets secure
- ✅ Allow different values per environment

Variables with `sync: false` must be set manually in Render Dashboard.
