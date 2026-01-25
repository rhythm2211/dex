# Frontend Deployment Guide - Step by Step

This guide will help you deploy the frontend to Railway, connect it to your backend, and bind it to dex.net.in.

## Prerequisites
- ✅ Backend deployed on Railway (running on port 8080)
- ✅ Domain: dex.net.in
- ✅ Railway account

---

## Step 1: Get Your Backend Railway URL

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click on your **backend service**
3. Go to **Settings** → **Networking**
4. Copy the **Public Domain** URL (e.g., `https://your-backend-production.up.railway.app`)
5. **Save this URL** - you'll need it in the next step

**Test your backend URL:**
```bash
# Replace with your actual backend URL
curl https://your-backend-production.up.railway.app/health
```

---

## Step 2: Create Frontend Service on Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project** (or select existing project)
3. Click **New Service** → **GitHub Repo**
4. Select your repository
5. **IMPORTANT**: In the settings, set:
   - **Root Directory**: `frontend`
   - **Build Command**: (leave empty, Dockerfile handles it)
   - **Start Command**: (leave empty, Dockerfile handles it)

Railway will automatically detect the `Dockerfile` in the frontend directory.

---

## Step 3: Configure Environment Variables in Railway

Go to your **frontend service** in Railway → **Variables** tab and add:

### Required Variables:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=https://dex-production-6dd4.up.railway.app
INTERNAL_API_URL=https://dex-production-6dd4.up.railway.app

# Frontend URL (will be updated after domain setup)
NEXTAUTH_URL=https://dex.net.in

# NextAuth Secret (copy from your .env.local or generate new with: openssl rand -base64 32)
NEXTAUTH_SECRET=your_nextauth_secret_here

# OAuth Providers (copy from your .env.local file - DO NOT commit secrets!)
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

AZURE_AD_CLIENT_ID=your_azure_client_id
AZURE_AD_CLIENT_SECRET=your_azure_client_secret
AZURE_AD_TENANT_ID=common
```

**Important Notes:**
- ✅ Backend URL is already configured: `https://dex-production-6dd4.up.railway.app`
- ⚠️ **Copy OAuth secrets from `frontend/.env.local`** - DO NOT use placeholder values!
- Initially, `NEXTAUTH_URL` can be set to your Railway frontend URL (you'll update it after domain setup)
- Railway will automatically redeploy when you add variables

---

## Step 4: Update Backend CORS Settings

Your backend needs to allow requests from the frontend domain.

1. Go to your **backend service** in Railway → **Variables**
2. Add or update:
   ```env
   BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in","https://your-frontend.up.railway.app"]
   ```
   (Replace `your-frontend.up.railway.app` with your actual Railway frontend URL)

3. Railway will automatically redeploy the backend

---

## Step 5: Deploy Frontend

1. Railway should automatically start building after you add the environment variables
2. Go to **Deployments** tab to watch the build progress
3. Wait for deployment to complete (usually 3-5 minutes)
4. Once deployed, Railway will provide a URL like: `https://your-frontend-production.up.railway.app`

**Test the frontend:**
- Visit the Railway URL in your browser
- Check browser console for any errors
- Try logging in to verify backend connection

---

## Step 6: Configure Custom Domain in Railway

1. Go to your **frontend service** in Railway
2. Go to **Settings** → **Networking**
3. Scroll down to **Custom Domain**
4. Click **Add Custom Domain**
5. Enter: `dex.net.in`
6. Railway will provide DNS records (CNAME or A record)

---

## Step 7: Update DNS Records

Go to your domain registrar (where you manage dex.net.in) and add the DNS record Railway provides:

### If Railway gives you a CNAME:
- **Type**: CNAME
- **Name**: @ (or leave blank for root domain)
- **Value**: Railway's CNAME target (e.g., `cname.railway.app`)

### If Railway gives you an A record:
- **Type**: A
- **Name**: @ (or leave blank for root domain)
- **Value**: Railway's IP address

**Also add www subdomain:**
- **Type**: CNAME
- **Name**: www
- **Value**: `dex.net.in` (or Railway's CNAME target)

**Note:** DNS propagation can take 5 minutes to 48 hours, but usually works within 15-30 minutes.

---

## Step 8: Update NEXTAUTH_URL After Domain is Live

Once your domain is working (you can access https://dex.net.in):

1. Go to **frontend service** in Railway → **Variables**
2. Update:
   ```env
   NEXTAUTH_URL=https://dex.net.in
   ```
3. Railway will automatically redeploy

---

## Step 9: Verify Everything Works

1. **Test Frontend:**
   - Visit: https://dex.net.in
   - Should load without errors

2. **Test Backend Connection:**
   - Open browser console (F12)
   - Try logging in or making an API call
   - Check for CORS errors (should be none)

3. **Test OAuth:**
   - Try logging in with GitHub/Google
   - Should redirect properly

4. **Check Health:**
   - Visit: https://dex.net.in/health (if you have a health page)

---

## Troubleshooting

### Frontend won't connect to backend:
- ✅ Verify `NEXT_PUBLIC_API_URL` is correct in Railway variables
- ✅ Check backend CORS settings include your frontend domain
- ✅ Test backend URL directly: `curl https://your-backend.railway.app/health`

### Domain not working:
- ✅ Wait 15-30 minutes for DNS propagation
- ✅ Check DNS records are correct using: `nslookup dex.net.in`
- ✅ Verify Railway shows domain as "Active" in Networking settings

### OAuth redirect errors:
- ✅ Update OAuth provider settings (GitHub/Google) with new callback URLs:
  - GitHub: `https://dex.net.in/api/auth/callback/github`
  - Google: `https://dex.net.in/api/auth/callback/google`
  - Azure: `https://dex.net.in/api/auth/callback/azure-ad`

### Build fails:
- ✅ Check Railway build logs
- ✅ Verify all environment variables are set
- ✅ Check Dockerfile is in frontend directory

---

## Next Steps

- [ ] Set up monitoring (UptimeRobot, Pingdom)
- [ ] Configure backups
- [ ] Set up CI/CD for automatic deployments
- [ ] Add error tracking (Sentry)

---

**Congratulations!** Your frontend should now be live at https://dex.net.in 🎉
