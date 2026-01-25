# Frontend Deployment Checklist

Follow these steps in order:

## ✅ Step 1: Get Backend URL
- [ ] Go to Railway Dashboard → Backend Service → Settings → Networking
- [ ] Copy Public Domain URL: `https://____________________.railway.app`
- [ ] Test it: `curl https://your-backend.railway.app/health`

## ✅ Step 2: Create Frontend Service
- [ ] Go to Railway Dashboard → New Service → GitHub Repo
- [ ] Select your repository
- [ ] Set Root Directory: `frontend`
- [ ] Railway will auto-detect Dockerfile

## ✅ Step 3: Add Environment Variables
Go to Frontend Service → Variables tab, add:

```
NEXT_PUBLIC_API_URL=https://dex-production-6dd4.up.railway.app
INTERNAL_API_URL=https://dex-production-6dd4.up.railway.app
NEXTAUTH_URL=https://dex.net.in
NEXTAUTH_SECRET=copy_from_env_local
GITHUB_ID=copy_from_env_local
GITHUB_SECRET=copy_from_env_local
GOOGLE_CLIENT_ID=copy_from_env_local
GOOGLE_CLIENT_SECRET=copy_from_env_local
AZURE_AD_CLIENT_ID=copy_from_env_local
AZURE_AD_CLIENT_SECRET=copy_from_env_local
AZURE_AD_TENANT_ID=common

# ⚠️ IMPORTANT: Copy actual secret values from frontend/.env.local file!
```

✅ **Backend URL configured: `https://dex-production-6dd4.up.railway.app`**

## ✅ Step 4: Update Backend CORS
- [ ] Go to Backend Service → Variables
- [ ] Add/Update: `BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in","https://your-frontend.railway.app"]`
- [ ] Replace `your-frontend.railway.app` with your Railway frontend URL

## ✅ Step 5: Wait for Deployment
- [ ] Check Deployments tab
- [ ] Wait for build to complete (3-5 minutes)
- [ ] Copy your frontend Railway URL: `https://____________________.railway.app`

## ✅ Step 6: Add Custom Domain
- [ ] Go to Frontend Service → Settings → Networking
- [ ] Click "Add Custom Domain"
- [ ] Enter: `dex.net.in`
- [ ] Copy the DNS record Railway provides

## ✅ Step 7: Update DNS
- [ ] Go to your domain registrar
- [ ] Add the DNS record Railway provided (CNAME or A record)
- [ ] Wait 15-30 minutes for DNS propagation

## ✅ Step 8: Update OAuth Callbacks
- [ ] GitHub: Settings → OAuth Apps → Update callback URL to `https://dex.net.in/api/auth/callback/github`
- [ ] Google: Google Cloud Console → Update redirect URI to `https://dex.net.in/api/auth/callback/google`
- [ ] Azure: Azure Portal → Update redirect URI to `https://dex.net.in/api/auth/callback/azure-ad`

## ✅ Step 9: Test Everything
- [ ] Visit: https://dex.net.in
- [ ] Test login
- [ ] Test API calls
- [ ] Check browser console for errors

---

**Need help?** See `FRONTEND_DEPLOYMENT.md` for detailed instructions.
