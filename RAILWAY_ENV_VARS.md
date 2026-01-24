# Railway Environment Variables Checklist

**⚠️ CRITICAL**: Railway does NOT use `.env` files. You MUST set all environment variables in the Railway Dashboard.

## Quick Fix for Current Error

If you're seeing `connection to server at "127.0.0.1"` errors, it means `POSTGRES_HOST` is not set in Railway.

**Fix**: Go to Railway Dashboard → Your Service → Variables tab → Add `POSTGRES_HOST=db.zyrxhllgdgowsbjislaq.supabase.co`

## Required Environment Variables

Add these in Railway Dashboard → Your Service → Variables tab:

### Copy-Paste Ready (Raw Editor)

```env
ENVIRONMENT=production
DEBUG=false
POSTGRES_HOST=db.zyrxhllgdgowsbjislaq.supabase.co
POSTGRES_PORT=6543
POSTGRES_USER=postgres
POSTGRES_PASSWORD=[@Muj219302335]
POSTGRES_DB=postgres
POSTGRES_VECTOR_TABLE=document_vectors
GROQ_API_KEY=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
GITHUB_TOKEN=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
NEO4J_URI=neo4j+s://f5c2d367.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=N4jbHcSTHB8hVu5js2KHKuadLosl6Y0YpLoIZ2oSNhw
NEO4J_DATABASE=neo4j
BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in"]
FRONTEND_URL=https://dex.net.in
```

### Individual Variables (if adding one by one)

| Variable | Value |
|----------|-------|
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |
| `POSTGRES_HOST` | `db.zyrxhllgdgowsbjislaq.supabase.co` |
| `POSTGRES_PORT` | `6543` |
| `POSTGRES_USER` | `postgres` |
| `POSTGRES_PASSWORD` | `[@Muj219302335]` |
| `POSTGRES_DB` | `postgres` |
| `POSTGRES_VECTOR_TABLE` | `document_vectors` |
| `GROQ_API_KEY` | `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` |
| `GITHUB_TOKEN` | `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` |
| `NEO4J_URI` | `neo4j+s://f5c2d367.databases.neo4j.io` |
| `NEO4J_USERNAME` | `neo4j` |
| `NEO4J_PASSWORD` | `N4jbHcSTHB8hVu5js2KHKuadLosl6Y0YpLoIZ2oSNhw` |
| `NEO4J_DATABASE` | `neo4j` |
| `BACKEND_CORS_ORIGINS` | `["https://dex.net.in","https://www.dex.net.in"]` |
| `FRONTEND_URL` | `https://dex.net.in` |

## Optional Environment Variables

```env
# OpenAI (optional fallback)
OPENAI_API_KEY=

# Email Service (Resend) - Optional
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_FROM_NAME=DEX
```

## Important Notes

1. **POSTGRES_PORT**: Use `6543` for connection pooler (recommended) or `5432` for direct connection
2. **POSTGRES_PASSWORD**: Make sure to URL-encode special characters like `[@Muj219302335]` - the app handles this automatically
3. **BACKEND_CORS_ORIGINS**: Must be valid JSON array format with double quotes
4. **No .env file needed**: Railway uses environment variables directly, not .env files

## How to Add Variables in Railway

### Method 1: Raw Editor (Fastest)

1. Go to Railway Dashboard → Your Project → Your Service
2. Click the **Variables** tab
3. Click **Raw Editor** button (top right)
4. Paste all the variables from the "Copy-Paste Ready" section above
5. Click **Save**
6. Railway will automatically redeploy

### Method 2: One by One

1. Go to Railway Dashboard → Your Project → Your Service
2. Click the **Variables** tab
3. Click **+ New Variable**
4. Enter the variable name and value from the table above
5. Click **Add**
6. Repeat for each variable
7. Railway will automatically redeploy after each addition

## Verification

After setting variables, check the deployment logs. You should see:

✅ **Success indicators:**
- `Database connection: postgres@db.zyrxhllgdgowsbjislaq.supabase.co:6543/postgres`
- `✅ Database initialized successfully`
- No warnings about `POSTGRES_HOST` being localhost

❌ **Error indicators:**
- `connection to server at "127.0.0.1"` → `POSTGRES_HOST` not set
- `connection to server at "localhost"` → `POSTGRES_HOST` not set
- `⚠️ WARNING: POSTGRES_HOST is 'localhost' in production!` → Missing env var

## Troubleshooting

### Error: "connection to server at 127.0.0.1"
**Cause**: `POSTGRES_HOST` environment variable is not set  
**Fix**: Add `POSTGRES_HOST=db.zyrxhllgdgowsbjislaq.supabase.co` in Railway Variables

### Error: "Could not find .env file"
**Cause**: This is normal in Railway - it uses environment variables, not .env files  
**Fix**: Ignore this warning, just make sure all variables are set in Railway Dashboard

### Error: "GROQ_API_KEY is not set"
**Cause**: `GROQ_API_KEY` environment variable is not set  
**Fix**: Add `GROQ_API_KEY` in Railway Variables

### Error: "Network is unreachable" with IPv6 address
**Cause**: Railway's network is trying to connect via IPv6, but Railway doesn't support IPv6 or Supabase isn't reachable via IPv6  
**Symptoms**: 
- `Failed to resolve db.xxxxx.supabase.co to IPv4`
- `connection to server at "db.xxxxx.supabase.co" (2406:da1a:...) failed: Network is unreachable`

**Solutions** (try in order):

1. **Check Supabase Network Restrictions**:
   - Go to Supabase Dashboard → Project Settings → Database → Network Restrictions
   - Make sure there are no IP restrictions blocking Railway
   - Or temporarily disable restrictions to test

2. **Enable Supabase IPv4 Add-on** (if connection pooler doesn't work):
   - Even with connection pooler (port 6543), you may need the IPv4 add-on
   - Go to Supabase Dashboard → Project Settings → Addons
   - Enable "IPv4" add-on ($4/month)
   - This provides a dedicated IPv4 endpoint

3. **Use Direct Connection with IPv4 Add-on**:
   - If pooler still doesn't work, try direct connection:
   - Change `POSTGRES_PORT=5432` in Railway Variables
   - Make sure IPv4 add-on is enabled in Supabase

4. **Check Railway Network Settings**:
   - Railway's network should support outbound connections
   - If you're on a restricted plan, check if database connections are allowed

### Port Issues
- Railway automatically sets `PORT` environment variable
- The Dockerfile uses `${PORT:-8000}` which handles this correctly
- You don't need to set `PORT` manually
