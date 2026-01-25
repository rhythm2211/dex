# Railway Frontend Environment Variables

## ⚠️ IMPORTANT: Set These in Railway Dashboard

The frontend `.env.local` file is for **local development only**. For production deployment on Railway, you **MUST** set these environment variables in the Railway Dashboard.

## Required Environment Variables for Frontend Service

Go to **Railway Dashboard** → **Frontend Service** → **Variables** tab and add:

```env
# Backend API URL (Production)
NEXT_PUBLIC_API_URL=https://dex-production-6dd4.up.railway.app
INTERNAL_API_URL=https://dex-production-6dd4.up.railway.app

# Frontend URL
NEXTAUTH_URL=https://dex.net.in

# NextAuth Secret (copy from frontend/.env.local)
# ⚠️ DO NOT commit actual secrets - use placeholder
NEXTAUTH_SECRET=your_nextauth_secret_here

# OAuth Providers (copy from frontend/.env.local)
# ⚠️ DO NOT commit actual secrets - use placeholders in this file
GITHUB_ID=your_github_client_id_here
GITHUB_SECRET=your_github_client_secret_here

GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

AZURE_AD_CLIENT_ID=your_azure_ad_client_id_here
AZURE_AD_CLIENT_SECRET=your_azure_ad_client_secret_here
AZURE_AD_TENANT_ID=common
```

## Quick Setup Steps

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Select your Frontend Service**
3. **Click "Variables" tab**
4. **Click "Raw Editor"** (top right) for faster entry
5. **Paste all variables above**
6. **Click "Save"**
7. **Railway will automatically redeploy** with new variables

## Verification

After setting variables and redeploying:

1. **Check deployment logs** for successful build
2. **Test login** - Open browser DevTools (F12) → Console
3. **Log in with OAuth** (GitHub, Google, or Azure)
4. **Look for these logs**:
   - `[NextAuth] API URL: https://dex-production-6dd4.up.railway.app` ✅
   - `✅ Created user profile for: ...` ✅
5. **Check database**:
   ```sql
   SELECT email, name, last_login, created_at 
   FROM users 
   ORDER BY created_at DESC;
   ```

## Troubleshooting

### Users still not being saved?

1. **Verify API URL in console**: Should show `https://dex-production-6dd4.up.railway.app`, NOT `localhost`
2. **Check backend CORS**: Backend `BACKEND_CORS_ORIGINS` should include your frontend URL
3. **Check backend logs**: Look for `POST /api/v1/users` requests
4. **Test backend directly**:
   ```bash
   curl https://dex-production-6dd4.up.railway.app/health
   ```

### Still seeing localhost in console?

- Railway environment variables take precedence
- Make sure variables are set in Railway Dashboard, not just `.env.local`
- Redeploy after setting variables

## Current Configuration

✅ **Backend URL**: `https://dex-production-6dd4.up.railway.app`
✅ **Frontend URL**: `https://dex.net.in`
✅ **Updated**: Frontend `.env.local` file (for local dev reference)

**Next Step**: Set these same values in Railway Dashboard → Frontend Service → Variables
