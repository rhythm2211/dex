# Free Production Hosting Guide for DEX

This guide will walk you through hosting DEX for free while maintaining production-grade quality.

## Overview

**Free Hosting Stack:**
- **Domain**: Namecheap/Cloudflare (paid, ~$10-15/year)
- **Frontend**: Vercel (free tier - excellent for Next.js)
- **Backend**: Railway or Render (free tier)
- **PostgreSQL**: Railway, Supabase, or Neon (free tier)
- **Neo4j**: Neo4j Aura Free tier (or self-hosted)
- **CDN/DNS**: Cloudflare (free tier)

## Step-by-Step Guide

### Step 1: Purchase Domain

**Recommended Providers:**
1. **Cloudflare Registrar** (Recommended)
   - Cost: ~$8-12/year
   - Free privacy protection
   - Easy DNS management
   - Link: https://www.cloudflare.com/products/registrar/

2. **Namecheap**
   - Cost: ~$10-15/year
   - Good support
   - Link: https://www.namecheap.com/

**What to do:**
1. Choose a domain name (e.g., `yourdexapp.com`)
2. Purchase the domain
3. Note: We'll configure DNS in Step 5

---

### Step 2: Set Up PostgreSQL Database (Free)

**Option A: Railway (Recommended - Easiest)**
1. Go to https://railway.app/
2. Sign up with GitHub
3. Click "New Project"
4. Click "Provision PostgreSQL"
5. Wait for database to be created
6. Click on PostgreSQL service
7. Go to "Variables" tab
8. Copy the connection string (DATABASE_URL)
9. Note: You'll need to install pgvector extension manually

**Option B: Supabase (Free Tier)**
1. Go to https://supabase.com/
2. Sign up
3. Create new project
4. Go to Settings → Database
5. Copy connection string
6. Enable pgvector: Run `CREATE EXTENSION vector;` in SQL editor

**Option C: Neon (Free Tier)**
1. Go to https://neon.tech/
2. Sign up
3. Create project
4. Copy connection string
5. pgvector is pre-installed

**What you'll get:**
- PostgreSQL connection string
- Database credentials
- Save these for Step 6

---

### Step 3: Set Up Neo4j (Free)

**Option A: Neo4j Aura Free Tier (Recommended)**
1. Go to https://neo4j.com/cloud/aura/
2. Sign up for free account
3. Create free database instance
4. Choose region closest to you
5. Wait for instance to be created (~2 minutes)
6. Copy connection URI, username, and password
7. Save these credentials

**Option B: Self-Hosted (Advanced)**
- Use Railway or Render to host Neo4j
- More complex but gives you full control

**What you'll get:**
- NEO4J_URI (e.g., `neo4j+s://xxxxx.databases.neo4j.io`)
- NEO4J_USERNAME
- NEO4J_PASSWORD

---

### Step 4: Deploy Frontend to Vercel (Free)

**Why Vercel:**
- Perfect for Next.js
- Free SSL/HTTPS
- Global CDN
- Automatic deployments
- Free tier: Unlimited bandwidth for personal projects

**Steps:**

1. **Prepare your code:**
   ```bash
   # Make sure your code is pushed to GitHub
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to https://vercel.com/
   - Sign up with GitHub
   - Click "Add New Project"
   - Import your repository
   - Select the `frontend` folder as root directory
   - Configure:
     - **Framework Preset**: Next.js
     - **Root Directory**: `frontend`
     - **Build Command**: `npm run build` (default)
     - **Output Directory**: `.next` (default)

3. **Environment Variables:**
   Add these in Vercel project settings:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
   INTERNAL_API_URL=https://your-backend-url.railway.app
   NEXTAUTH_URL=https://your-domain.com
   NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
   GITHUB_CLIENT_ID=your_github_oauth_id
   GITHUB_CLIENT_SECRET=your_github_oauth_secret
   GOOGLE_CLIENT_ID=your_google_oauth_id
   GOOGLE_CLIENT_SECRET=your_google_oauth_secret
   RESEND_API_KEY=your_resend_key (optional)
   ```

4. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete
   - You'll get a URL like: `your-project.vercel.app`

**What you'll get:**
- Frontend URL: `https://your-project.vercel.app`
- We'll connect your domain in Step 5

---

### Step 5: Deploy Backend to Railway (Free)

**Why Railway:**
- Free tier: $5 credit/month (enough for small apps)
- Easy PostgreSQL integration
- Automatic deployments
- Simple configuration

**Steps:**

1. **Prepare Backend:**
   - Make sure `app/backend/Dockerfile` exists
   - Ensure `app/requirements.txt` is up to date

2. **Deploy to Railway:**
   - Go to https://railway.app/
   - Sign up with GitHub
   - Click "New Project"
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Railway will detect Dockerfile automatically

3. **Configure Service:**
   - Railway will create a service from your Dockerfile
   - Go to service settings
   - Set root directory: `app`
   - Set Dockerfile path: `backend/Dockerfile`

4. **Add Environment Variables:**
   Go to Variables tab and add:
   ```
   ENVIRONMENT=production
   DEBUG=false
   POSTGRES_HOST=your-postgres-host
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your-password
   POSTGRES_DB=dex
   POSTGRES_VECTOR_TABLE=document_vectors
   NEO4J_URI=your-neo4j-uri
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your-neo4j-password
   GROQ_API_KEY=your-groq-key
   BACKEND_CORS_ORIGINS=["https://your-domain.com","https://your-project.vercel.app"]
   RESEND_API_KEY=your-resend-key (optional)
   FRONTEND_URL=https://your-domain.com
   ```

5. **Generate Public URL:**
   - Go to Settings → Networking
   - Click "Generate Domain"
   - You'll get: `your-backend.railway.app`
   - Copy this URL

6. **Update Frontend:**
   - Go back to Vercel
   - Update `NEXT_PUBLIC_API_URL` to your Railway URL
   - Redeploy frontend

**Alternative: Render (Free Tier)**
- Go to https://render.com/
- Sign up
- Create new Web Service
- Connect GitHub repo
- Set root directory: `app`
- Set Dockerfile path: `backend/Dockerfile`
- Add environment variables
- Get free URL: `your-backend.onrender.com`

---

### Step 6: Configure Domain & DNS

**Using Cloudflare (Recommended - Free):**

1. **Add Domain to Cloudflare:**
   - Sign up at https://cloudflare.com/
   - Add your domain
   - Cloudflare will scan your existing DNS
   - Update nameservers at your registrar to Cloudflare's

2. **Configure DNS Records:**

   **For Frontend (Vercel):**
   - Go to Vercel project → Settings → Domains
   - Add your domain: `your-domain.com`
   - Add www: `www.your-domain.com`
   - Vercel will provide DNS records
   - Add these in Cloudflare:
     ```
     Type: CNAME
     Name: @
     Target: cname.vercel-dns.com
     
     Type: CNAME
     Name: www
     Target: cname.vercel-dns.com
     ```

   **For Backend (Railway):**
   - Go to Railway service → Settings → Networking
   - Add custom domain: `api.your-domain.com`
   - Railway will provide DNS record
   - Add in Cloudflare:
     ```
     Type: CNAME
     Name: api
     Target: your-backend.railway.app
     ```

3. **Enable SSL:**
   - Cloudflare: Automatic (Full SSL mode)
   - Vercel: Automatic
   - Railway: Automatic with custom domain

4. **Wait for Propagation:**
   - DNS changes take 5-60 minutes
   - Check with: `nslookup your-domain.com`

---

### Step 7: Update Environment Variables

**Frontend (Vercel):**
```
NEXT_PUBLIC_API_URL=https://api.your-domain.com
INTERNAL_API_URL=https://api.your-domain.com
NEXTAUTH_URL=https://your-domain.com
```

**Backend (Railway):**
```
BACKEND_CORS_ORIGINS=["https://your-domain.com","https://www.your-domain.com"]
FRONTEND_URL=https://your-domain.com
```

---

### Step 8: Set Up PostgreSQL with pgvector

**If using Railway PostgreSQL:**
1. Connect to your Railway PostgreSQL
2. Run SQL:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

**If using Supabase:**
1. Go to SQL Editor
2. Run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

**If using Neon:**
- pgvector is pre-installed

---

### Step 9: Initialize Database

**Option 1: Via Railway CLI**
```bash
railway connect postgres
psql
CREATE EXTENSION vector;
\q
```

**Option 2: Via Connection String**
```bash
psql "your-connection-string"
CREATE EXTENSION vector;
```

**Option 3: Via Backend (Automatic)**
- The backend will create tables on first run
- Just ensure pgvector extension is installed

---

### Step 10: Test Your Deployment

1. **Test Frontend:**
   - Visit: `https://your-domain.com`
   - Should load the landing page

2. **Test Backend:**
   - Visit: `https://api.your-domain.com/health`
   - Should return: `{"status": "active", ...}`

3. **Test API Connection:**
   - Frontend should be able to call backend
   - Check browser console for errors

---

### Step 11: Set Up CI/CD (Optional but Recommended)

Your GitHub Actions workflows are already set up!

**For Vercel:**
- Automatic deployments on push to main
- Already configured if you connected GitHub

**For Railway:**
- Automatic deployments on push to main
- Configure in Railway dashboard

**Update workflows:**
- Update `deploy.yml` with your Railway/Render URLs
- Or disable auto-deploy and use manual deployment

---

### Step 12: Monitor & Maintain

**Free Monitoring:**
1. **Vercel Analytics** (Free tier)
   - Built into Vercel dashboard
   - View page views, performance

2. **Railway Metrics** (Free tier)
   - View CPU, memory usage
   - Check logs

3. **Uptime Monitoring:**
   - Use https://uptimerobot.com/ (free tier)
   - Monitor your domain and API

**Maintenance:**
- Check logs regularly
- Monitor free tier limits
- Keep dependencies updated
- Backup database regularly

---

## Cost Breakdown

**Monthly Costs:**
- Domain: ~$1/month (annual payment)
- Vercel: $0 (free tier)
- Railway: $0 (free tier with $5 credit)
- PostgreSQL: $0 (free tier)
- Neo4j Aura: $0 (free tier)
- Cloudflare: $0 (free tier)

**Total: ~$1/month** (just the domain)

---

## Free Tier Limits

**Vercel:**
- 100GB bandwidth/month
- Unlimited requests
- Perfect for personal/small projects

**Railway:**
- $5 credit/month
- ~500 hours of runtime
- Enough for small-medium apps

**Neo4j Aura Free:**
- 1 database
- 50K nodes
- 175K relationships
- Perfect for small projects

**PostgreSQL (Railway/Supabase/Neon):**
- 500MB-1GB storage
- Enough for development/small production

---

## Troubleshooting

### Domain Not Working
- Wait 24-48 hours for full DNS propagation
- Check DNS records in Cloudflare
- Verify nameservers are correct

### Backend Not Accessible
- Check Railway service is running
- Verify environment variables
- Check logs in Railway dashboard

### Frontend Can't Connect to Backend
- Verify CORS settings
- Check API URL in frontend env vars
- Test backend health endpoint directly

### Database Connection Issues
- Verify connection string
- Check pgvector extension is installed
- Ensure database is accessible from Railway

---

## Next Steps

1. ✅ Purchase domain
2. ✅ Set up PostgreSQL
3. ✅ Set up Neo4j
4. ✅ Deploy frontend to Vercel
5. ✅ Deploy backend to Railway
6. ✅ Configure DNS
7. ✅ Test everything
8. ✅ Set up monitoring

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app/
- **Cloudflare Docs**: https://developers.cloudflare.com/
- **Neo4j Aura Docs**: https://neo4j.com/docs/aura/

---

**You're all set! Your DEX app will be live on your custom domain with free hosting! 🚀**
