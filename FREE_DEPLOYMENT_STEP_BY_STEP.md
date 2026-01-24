# Free Deployment Guide for dex.net.in - Step by Step

This guide will help you deploy DEX to `dex.net.in` **completely FREE** using free tiers of various services.

## 🎯 What We'll Use (All Free)

- **Frontend**: Vercel (Free forever)
- **Backend**: Railway or Render (Free tier)
- **PostgreSQL**: Supabase or Neon (Free tier with pgvector)
- **Neo4j**: Neo4j Aura Free tier
- **Domain**: dex.net.in (you already have this)

**Total Cost**: $0/month (except your domain ~$1/month)

---

## Step 1: Set Up PostgreSQL Database (Free) - 10 minutes

### Option A: Supabase (Recommended)

1. **Sign up**: Go to https://supabase.com and create a free account
2. **Create project**:
   - Click "New Project"
   - Name: `dex-database`
   - Database Password: Create a strong password (save it!)
   - Region: Choose closest to you
   - Click "Create new project"
   - Wait 2-3 minutes for setup

3. **Enable pgvector extension**:
   - Go to your project → SQL Editor
   - Run this query:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   - Click "Run"

4. **Get connection details**:
   - Go to Settings → Database
   - Copy these values (you'll need them later):
     - **Host**: `db.xxxxx.supabase.co`
     - **Port**: `5432`
     - **Database**: `postgres`
     - **User**: `postgres`
     - **Password**: (the one you created)
     - **Connection String**: Copy the URI format

**Save these details!** You'll need them in Step 3.

---

## Step 2: Set Up Neo4j (Free) - 5 minutes

1. **Sign up**: Go to https://neo4j.com/cloud/aura/ and create a free account
2. **Create free database**:
   - Click "Create Database"
   - Choose "Free" tier
   - Name: `dex-graph`
   - Region: Choose closest
   - Click "Create"
   - Wait 1-2 minutes

3. **Get connection details**:
   - Copy the **Connection URI** (looks like: `neo4j+s://xxxxx.databases.neo4j.io`)
   - Copy the **Username** (usually `neo4j`)
   - Copy the **Password** (save it securely!)

**Save these details!** You'll need them in Step 3.

---

## Step 3: Deploy Backend to Railway (Free) - 15 minutes

### 3.1: Sign Up for Railway

1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign up with GitHub (easiest way)

### 3.2: Create Backend Service

1. **Create new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `dex` repository
   - Select the repository

2. **Configure service**:
   - Railway will detect your Dockerfile
   - It should find: `app/backend/Dockerfile`
   - If not, set:
     - **Root Directory**: `app/backend`
     - **Dockerfile Path**: `Dockerfile`

3. **Add environment variables**:
   Click "Variables" tab and add:

   ```env
   ENVIRONMENT=production
   DEBUG=false
   
   # PostgreSQL (from Supabase Step 1)
   POSTGRES_HOST=db.xxxxx.supabase.co
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_supabase_password
   POSTGRES_DB=postgres
   
   # Neo4j (from Step 2)
   NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your_neo4j_password
   
   # Groq API
   GROQ_API_KEY=your_groq_api_key
   
   # CORS - We'll update this after frontend is deployed
   BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in","https://your-app.vercel.app"]
   
   # Frontend URL
   FRONTEND_URL=https://dex.net.in
   ```

4. **Deploy**:
   - Railway will automatically deploy
   - Wait 3-5 minutes
   - Check the "Deployments" tab

5. **Get backend URL**:
   - Go to "Settings" → "Networking"
   - Railway will generate a URL like: `dex-backend-production.up.railway.app`
   - **Copy this URL** - you'll need it for frontend

6. **Generate custom domain** (optional for now):
   - You can add `api.dex.net.in` later
   - For now, use the Railway URL

---

## Step 4: Deploy Frontend to Vercel (Free) - 10 minutes

### 4.1: Sign Up for Vercel

1. Go to https://vercel.com
2. Click "Sign Up"
3. Sign up with GitHub (easiest)

### 4.2: Import Project

1. **Import repository**:
   - Click "Add New" → "Project"
   - Select your `dex` repository
   - Click "Import"

2. **Configure project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

3. **Add environment variables**:
   Click "Environment Variables" and add:

   ```env
   # Use Railway backend URL (from Step 3)
   NEXT_PUBLIC_API_URL=https://dex-backend-production.up.railway.app
   INTERNAL_API_URL=https://dex-backend-production.up.railway.app
   
   # Will update to your domain later
   NEXTAUTH_URL=https://dex.net.in
   
   # Generate secret: openssl rand -base64 32
   NEXTAUTH_SECRET=your_generated_secret_here
   
   # OAuth (if using - optional)
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

4. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes
   - Vercel will give you a URL like: `dex-frontend.vercel.app`

5. **Note the Vercel URL** - you'll need it for the next step

---

## Step 5: Update Backend CORS - 5 minutes

Go back to Railway (Step 3):

1. **Update environment variable**:
   - Go to your backend service → Variables
   - Update `BACKEND_CORS_ORIGINS`:
   ```env
   BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in","https://dex-frontend.vercel.app"]
   ```
   - Replace `dex-frontend.vercel.app` with your actual Vercel URL

2. **Redeploy** (Railway auto-redeploys when you change env vars)

---

## Step 6: Configure Custom Domain (dex.net.in) - 10 minutes

### 6.1: Add Domain to Vercel (Frontend)

1. **In Vercel dashboard**:
   - Go to your project → Settings → Domains
   - Click "Add Domain"
   - Enter: `dex.net.in`
   - Click "Add"
   - Also add: `www.dex.net.in`

2. **Configure DNS**:
   Vercel will show you DNS records to add:
   - **Type**: CNAME
   - **Name**: `@` (or root)
   - **Value**: `cname.vercel-dns.com`
   - **Type**: CNAME
   - **Name**: `www`
   - **Value**: `cname.vercel-dns.com`

3. **Add DNS records at your registrar**:
   - Go to where you bought `dex.net.in`
   - Add the CNAME records Vercel provided
   - Wait 5-10 minutes for DNS to propagate

4. **Verify in Vercel**:
   - Vercel will show "Valid Configuration" when DNS is correct
   - SSL certificate is automatic (free)

### 6.2: Add Domain to Railway (Backend - Optional)

1. **In Railway dashboard**:
   - Go to your backend service → Settings → Networking
   - Click "Custom Domain"
   - Add: `api.dex.net.in`
   - Railway will give you DNS records

2. **Add DNS record**:
   - At your registrar, add:
   - **Type**: CNAME
   - **Name**: `api`
   - **Value**: (Railway's CNAME value)

3. **Update frontend environment**:
   - Go back to Vercel
   - Update `NEXT_PUBLIC_API_URL` to: `https://api.dex.net.in`
   - Redeploy (automatic)

---

## Step 7: Update Environment Variables - 5 minutes

### 7.1: Update Vercel (Frontend)

Go to Vercel → Your Project → Settings → Environment Variables:

```env
NEXT_PUBLIC_API_URL=https://api.dex.net.in
# OR if you didn't set up custom domain:
# NEXT_PUBLIC_API_URL=https://dex-backend-production.up.railway.app

INTERNAL_API_URL=https://api.dex.net.in
NEXTAUTH_URL=https://dex.net.in
```

### 7.2: Update Railway (Backend)

Go to Railway → Your Service → Variables:

```env
BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in"]
FRONTEND_URL=https://dex.net.in
```

---

## Step 8: Test Your Deployment - 5 minutes

1. **Visit your site**:
   - Go to https://dex.net.in
   - Should see your DEX frontend

2. **Test backend**:
   - Go to https://api.dex.net.in/health
   - OR https://dex-backend-production.up.railway.app/health
   - Should return: `{"status":"ok"}`

3. **Test API docs**:
   - Go to https://api.dex.net.in/api/v1/docs
   - Should see FastAPI documentation

4. **Test frontend-backend connection**:
   - Try using the app
   - Check browser console for errors
   - Check Network tab to see API calls

---

## Step 9: Verify Everything Works - 5 minutes

✅ **Checklist**:
- [ ] Frontend loads at https://dex.net.in
- [ ] Backend health check works
- [ ] Frontend can call backend API
- [ ] SSL certificates are active (padlock icon)
- [ ] No CORS errors in browser console
- [ ] Can ingest a repository (test feature)

---

## 🎉 Congratulations!

Your DEX application is now live at **https://dex.net.in** - completely FREE!

---

## 📝 Important Notes

### Free Tier Limits:

**Vercel**:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Perfect for frontend

**Railway**:
- ⚠️ $5 free credit/month (usually enough for small apps)
- ⚠️ Sleeps after 7 days of inactivity (wakes on request)
- 💡 Consider Render as alternative (see below)

**Supabase**:
- ✅ 500MB database
- ✅ 2GB bandwidth/month
- ✅ Perfect for development/small apps

**Neo4j Aura**:
- ✅ Free tier available
- ✅ Limited to 50k nodes

### Alternative: Use Render Instead of Railway

If Railway free tier doesn't work for you:

1. **Sign up**: https://render.com
2. **Create Web Service**:
   - Connect GitHub repo
   - Root Directory: `app/backend`
   - Build Command: (auto-detected)
   - Start Command: (auto-detected from Dockerfile)
3. **Add environment variables** (same as Railway)
4. **Free tier**: Sleeps after 15 min inactivity, but free forever

---

## 🔧 Troubleshooting

### Frontend can't connect to backend:
- Check CORS settings in Railway
- Verify `NEXT_PUBLIC_API_URL` in Vercel
- Check browser console for errors

### Backend not responding:
- Check Railway logs
- Verify environment variables
- Check database connections

### DNS not working:
- Wait 24-48 hours for full propagation
- Use `dig dex.net.in` to check DNS
- Verify DNS records at registrar

### SSL certificate issues:
- Vercel handles SSL automatically
- Railway handles SSL automatically
- Just wait for DNS to propagate

---

## 🚀 Next Steps

1. **Set up monitoring**: Use UptimeRobot (free) to monitor your site
2. **Set up backups**: Export database regularly
3. **Optimize**: Monitor usage and upgrade if needed
4. **Custom domain for backend**: Set up `api.dex.net.in` (optional)

---

## 💰 Cost Summary

- **Vercel**: $0 (Free forever)
- **Railway/Render**: $0 (Free tier)
- **Supabase**: $0 (Free tier)
- **Neo4j Aura**: $0 (Free tier)
- **Domain**: ~$1/month (you already have this)

**Total**: $0/month (just your domain)

---

**You're all set!** 🎉

Your DEX application is now live at https://dex.net.in using completely free services!
