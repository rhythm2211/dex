# Next Steps - Frontend Deployment

✅ **Backend Verified**: `https://dex-production-6dd4.up.railway.app` is working!

---

## Step 2: Create Frontend Service on Railway

1. **Go to Railway Dashboard**: https://railway.app/dashboard

2. **Create New Service**:
   - Click on your project (or create a new one)
   - Click **"New Service"** → **"GitHub Repo"**
   - Select your repository

3. **Configure Service Settings**:
   - Click on the newly created service
   - Go to **Settings** tab
   - Set **Root Directory**: `frontend`
   - Leave **Build Command** and **Start Command** empty (Dockerfile handles it)

4. **Railway will automatically**:
   - Detect the `Dockerfile` in the frontend directory
   - Start building (but it will fail without environment variables - that's OK!)

---

## Step 3: Add Environment Variables

1. **Go to your Frontend Service** → **Variables** tab

2. **Add these variables one by one** (copy actual values from `frontend/.env.local`):

```
NEXT_PUBLIC_API_URL=https://dex-production-6dd4.up.railway.app
INTERNAL_API_URL=https://dex-production-6dd4.up.railway.app
NEXTAUTH_URL=https://dex.net.in
NEXTAUTH_SECRET=your_nextauth_secret_from_env_local
GITHUB_ID=your_github_client_id_from_env_local
GITHUB_SECRET=your_github_client_secret_from_env_local
GOOGLE_CLIENT_ID=your_google_client_id_from_env_local
GOOGLE_CLIENT_SECRET=your_google_client_secret_from_env_local
AZURE_AD_CLIENT_ID=your_azure_client_id_from_env_local
AZURE_AD_CLIENT_SECRET=your_azure_client_secret_from_env_local
AZURE_AD_TENANT_ID=common

# IMPORTANT: Copy the actual values from your frontend/.env.local file!
```

3. **After adding variables**, Railway will automatically redeploy

4. **Wait for deployment** (3-5 minutes) - check the **Deployments** tab

5. **Once deployed**, Railway will give you a URL like: `https://your-frontend-production.up.railway.app`

---

## Step 4: Update Backend CORS

After your frontend is deployed and you have the Railway frontend URL:

1. Go to **Backend Service** → **Variables** tab
2. Add or update:
   ```
   BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in","https://your-frontend.up.railway.app"]
   ```
   (Replace `your-frontend.up.railway.app` with your actual Railway frontend URL)

---

## Step 5: Test Frontend

1. Visit your Railway frontend URL
2. Check browser console (F12) for errors
3. Try logging in to verify backend connection

---

## Step 6: Add Custom Domain (dex.net.in)

Once frontend is working:

1. Go to **Frontend Service** → **Settings** → **Networking**
2. Scroll to **Custom Domain**
3. Click **"Add Custom Domain"**
4. Enter: `dex.net.in`
5. Railway will provide DNS records

---

## Step 7: Update DNS Records

1. Go to your domain registrar (where you manage dex.net.in)
2. Add the DNS record Railway provides
3. Wait 15-30 minutes for DNS propagation

---

**Ready to start?** Follow Step 2 above to create the frontend service!
