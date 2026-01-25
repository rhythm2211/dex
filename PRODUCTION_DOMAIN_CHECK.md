# Production Domain Configuration Guide

## Issue: Links Redirecting to Localhost

If you're seeing `http://localhost:3000/app` when clicking "Go to Dashboard" on your production site (`https://dex.net.in`), here's how to fix it:

## Root Cause

Relative paths like `/app` automatically use whatever domain the page is loaded from:
- If you access `https://dex.net.in` → links go to `https://dex.net.in/app` ✅
- If you access `http://localhost:3000` → links go to `http://localhost:3000/app` ❌

## Solutions

### 1. Ensure You're Accessing Production Domain

**Always access your site via:**
```
https://dex.net.in
```

**NOT:**
```
http://localhost:3000
```

### 2. Set Environment Variables in Railway

Make sure these are set in your **Railway Frontend Service** environment variables:

```env
NEXTAUTH_URL=https://dex.net.in
NEXT_PUBLIC_API_URL=https://dex-production-6dd4.up.railway.app
INTERNAL_API_URL=https://dex-production-6dd4.up.railway.app
```

### 3. Verify Production Build

After deploying to Railway:
1. Check Railway logs to ensure `NEXTAUTH_URL` is set correctly
2. Access your site via `https://dex.net.in` (not localhost)
3. Check browser console for any errors
4. Verify the URL in the address bar shows `https://dex.net.in`

### 4. Clear Browser Cache

If you've been testing locally:
1. Clear browser cache
2. Use incognito/private mode
3. Access `https://dex.net.in` directly

### 5. Check Railway Deployment

In Railway dashboard:
1. Go to your Frontend Service
2. Check the **Variables** tab
3. Ensure `NEXTAUTH_URL=https://dex.net.in` is set
4. Redeploy if needed

## Testing

### Test Production:
1. Open browser in incognito mode
2. Go to: `https://dex.net.in`
3. Click "Go to Dashboard"
4. Should redirect to: `https://dex.net.in/app` ✅

### If Still Redirecting to Localhost:

1. **Check Railway Environment Variables:**
   - Frontend Service → Variables
   - Verify `NEXTAUTH_URL=https://dex.net.in`

2. **Check Browser:**
   - Are you accessing via `https://dex.net.in`?
   - Or are you still on `http://localhost:3000`?

3. **Check Network Tab:**
   - Open browser DevTools → Network
   - Click "Go to Dashboard"
   - Check the request URL - what domain does it show?

4. **Redeploy:**
   - After setting environment variables, redeploy the frontend service
   - Railway will rebuild with the correct environment variables

## Code Verification

All links in the codebase use **relative paths** (correct):
- ✅ `<Link href="/app">` - Uses current domain
- ✅ `router.push("/app")` - Uses current domain
- ❌ No hardcoded `http://localhost:3000/app` found

## Summary

The issue is likely that:
1. You're accessing the site via `localhost` instead of `https://dex.net.in`
2. OR Railway environment variables aren't set correctly
3. OR the production build needs to be redeployed

**Solution:** Always access via `https://dex.net.in` and ensure Railway has the correct environment variables set.
