# How to Find Your Frontend Public URL on Railway

## Method 1: From Railway Dashboard (Easiest)

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Click on your Frontend Service**
3. **Look at the top of the page** - you should see a URL like:
   - `https://your-frontend-production.up.railway.app`
   - Or click the **"Generate Domain"** button if you don't see one

## Method 2: From Settings → Networking

1. **Go to your Frontend Service** in Railway
2. Click **Settings** tab
3. Click **Networking** section
4. Under **"Public Domain"**, you'll see your URL
5. If there's no domain, click **"Generate Domain"** button

## Method 3: From Service Overview

1. **Go to your Frontend Service**
2. Look at the **service card/header**
3. There should be a **link icon** or **URL** displayed
4. Click it to open your deployed frontend

## Quick Test

Once you have the URL, test it:
```powershell
# Replace with your actual URL
Invoke-WebRequest -Uri "https://your-frontend.up.railway.app" -UseBasicParsing
```

Or just open it in your browser!

---

**Next Steps:**
- ✅ Test the frontend URL
- ✅ Verify it connects to backend: `https://dex-production-6dd4.up.railway.app`
- ✅ Add custom domain: `dex.net.in`
