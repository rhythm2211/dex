# Quick Start: Deploy DEX in 30 Minutes

This is a condensed version for experienced developers who want to deploy quickly.

## Prerequisites
- Domain purchased
- GitHub repo ready
- API keys ready (GROQ, Neo4j)

## Quick Steps

### 1. Databases (5 min)

**PostgreSQL:**
```bash
# Railway
railway new → Provision PostgreSQL → Copy DATABASE_URL
# Or Supabase/Neon - create project, copy connection string
```

**Neo4j:**
```bash
# Neo4j Aura
Create free instance → Copy URI, username, password
```

### 2. Frontend - Vercel (5 min)

1. Go to vercel.com → Sign up with GitHub
2. New Project → Import repo
3. Root: `frontend`
4. Add env vars:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   NEXTAUTH_URL=https://your-domain.com
   NEXTAUTH_SECRET=<generate>
   ```
5. Deploy → Get URL

### 3. Backend - Railway (10 min)

1. Go to railway.app → Sign up with GitHub
2. New Project → Deploy from GitHub
3. Select repo → Auto-detects Dockerfile
4. Settings → Root: `app`, Dockerfile: `backend/Dockerfile`
5. Add env vars (see checklist)
6. Generate domain → Get URL

### 4. Domain & DNS (10 min)

**Cloudflare:**
1. Add domain to Cloudflare
2. Update nameservers at registrar
3. Add DNS:
   - `@ CNAME → cname.vercel-dns.com`
   - `api CNAME → your-backend.railway.app`
4. Vercel: Add custom domain
5. Railway: Add custom domain (api.your-domain.com)

### 5. Update & Test (5 min)

1. Update frontend env: `NEXT_PUBLIC_API_URL=https://api.your-domain.com`
2. Redeploy frontend
3. Test: `https://your-domain.com`
4. Test: `https://api.your-domain.com/health`

## Environment Variables Reference

**Frontend (Vercel):**
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
INTERNAL_API_URL=https://api.your-domain.com
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

**Backend (Railway):**
```env
ENVIRONMENT=production
DEBUG=false
POSTGRES_HOST=<from-railway>
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<from-railway>
POSTGRES_DB=dex
NEO4J_URI=<from-aura>
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<from-aura>
GROQ_API_KEY=<your-key>
BACKEND_CORS_ORIGINS=["https://your-domain.com"]
FRONTEND_URL=https://your-domain.com
```

## Common Issues

**Backend won't start:**
- Check all env vars are set
- Check logs in Railway
- Verify database connection

**Frontend can't connect:**
- Check CORS settings
- Verify API URL
- Check browser console

**Domain not working:**
- Wait 24-48 hours for DNS
- Verify nameservers
- Check DNS records

## Done! 🎉

Your app should be live at `https://your-domain.com`
