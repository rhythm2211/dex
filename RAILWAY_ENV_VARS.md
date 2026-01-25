# Railway Environment Variables Checklist

**⚠️ CRITICAL**: Railway does NOT use `.env` files. You MUST set all environment variables in the Railway Dashboard.

## Quick Fix for Current Error

If you're seeing `connection to server at "127.0.0.1"` errors, it means `POSTGRES_HOST` is not set in Railway.

**Fix**: Go to Railway Dashboard → Your Service → Variables tab → Add `POSTGRES_HOST=ep-damp-dream-ahsk1hhl-pooler.c-3.us-east-1.aws.neon.tech`

## Required Environment Variables

Add these in Railway Dashboard → Your Service → Variables tab:

### Copy-Paste Ready (Raw Editor)

```env
ENVIRONMENT=production
DEBUG=false
POSTGRES_HOST=ep-damp-dream-ahsk1hhl-pooler.c-3.us-east-1.aws.neon.tech
POSTGRES_PORT=5432
POSTGRES_USER=neondb_owner
POSTGRES_PASSWORD=YOUR_NEON_DB_PASSWORD
POSTGRES_DB=neondb
POSTGRES_VECTOR_TABLE=document_vectors
GROQ_API_KEY=YOUR_GROQ_API_KEY
GITHUB_TOKEN=YOUR_GITHUB_TOKEN
NEO4J_URI=neo4j+s://f5c2d367.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=YOUR_NEO4J_PASSWORD
NEO4J_DATABASE=neo4j
BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in"]
FRONTEND_URL=https://dex.net.in
```

### Individual Variables (if adding one by one)

| Variable | Value |
|----------|-------|
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |
| `POSTGRES_HOST` | `ep-damp-dream-ahsk1hhl-pooler.c-3.us-east-1.aws.neon.tech` |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_USER` | `neondb_owner` |
| `POSTGRES_PASSWORD` | `YOUR_NEON_DB_PASSWORD` (from Neon Dashboard) |
| `POSTGRES_DB` | `neondb` |
| `POSTGRES_VECTOR_TABLE` | `document_vectors` |
| `GROQ_API_KEY` | `YOUR_GROQ_API_KEY` (get from https://console.groq.com/) |
| `GITHUB_TOKEN` | `YOUR_GITHUB_TOKEN` (create at https://github.com/settings/tokens) |
| `NEO4J_URI` | `neo4j+s://f5c2d367.databases.neo4j.io` |
| `NEO4J_USERNAME` | `neo4j` |
| `NEO4J_PASSWORD` | `YOUR_NEO4J_PASSWORD` (from Neo4j Aura Dashboard) |
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

1. **POSTGRES_PORT**: Use `5432` for Neon DB (pooler port)
2. **POSTGRES_PASSWORD**: The app handles URL encoding automatically for special characters
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
- `Database connection: neondb_owner@ep-damp-dream-ahsk1hhl-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb`
- `✅ Database initialized successfully`
- No warnings about `POSTGRES_HOST` being localhost

❌ **Error indicators:**
- `connection to server at "127.0.0.1"` → `POSTGRES_HOST` not set
- `connection to server at "localhost"` → `POSTGRES_HOST` not set
- `⚠️ WARNING: POSTGRES_HOST is 'localhost' in production!` → Missing env var

## Troubleshooting

### Error: "connection to server at 127.0.0.1"
**Cause**: `POSTGRES_HOST` environment variable is not set  
**Fix**: Add `POSTGRES_HOST=ep-damp-dream-ahsk1hhl-pooler.c-3.us-east-1.aws.neon.tech` in Railway Variables

### Error: "Could not find .env file"
**Cause**: This is normal in Railway - it uses environment variables, not .env files  
**Fix**: Ignore this warning, just make sure all variables are set in Railway Dashboard

### Error: "GROQ_API_KEY is not set"
**Cause**: `GROQ_API_KEY` environment variable is not set  
**Fix**: Add `GROQ_API_KEY` in Railway Variables

### Error: "Network is unreachable" with IPv6 address
**Note**: Neon DB on AWS supports both IPv4 and IPv6 connections for free. If you see IPv6 connection errors, it's likely a Railway network configuration issue, not a Neon DB limitation.

**Symptoms**: 
- `Failed to resolve ep-xxxxx.neon.tech to IPv4`
- `connection to server at "ep-xxxxx.neon.tech" (2406:da1a:...) failed: Network is unreachable`

**Solutions** (try in order):

1. **Verify Connection Pooler is Used**:
   - Make sure you're using the pooler endpoint (ends with `-pooler`)
   - Example: `ep-xxxxx-pooler.xxxxx.aws.neon.tech`
   - Port should be `5432` for pooler
   - The pooler handles IPv4/IPv6 connectivity automatically

2. **Check Neon DB Network Settings**:
   - Go to Neon Dashboard → Project Settings → Network
   - Make sure there are no IP restrictions blocking Railway
   - Or temporarily disable restrictions to test

3. **Check Railway Network Settings**:
   - Railway's network should support outbound connections
   - If you're on a restricted plan, check if database connections are allowed
   - Railway should support both IPv4 and IPv6 outbound connections

### Port Issues
- Railway automatically sets `PORT` environment variable
- The Dockerfile uses `${PORT:-8000}` which handles this correctly
- You don't need to set `PORT` manually
