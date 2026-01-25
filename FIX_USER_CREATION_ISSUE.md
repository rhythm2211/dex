# Fix: Users Not Being Saved to Database

## Problem
Users are logging in successfully, but they're not being saved to the database. The `users` table remains empty even after multiple logins.

## Root Cause
The NextAuth callback is trying to call the backend API, but:
1. **In production**: The API URL might be pointing to `localhost:8000` which doesn't exist
2. **Errors are silent**: The errors are caught and logged but don't block sign-in, so users can log in but aren't saved
3. **Missing environment variables**: `INTERNAL_API_URL` or `NEXT_PUBLIC_API_URL` might not be set correctly in production

## Solution

### Step 1: Check Your Backend URL

1. **Go to Railway Dashboard** → Your Backend Service → Settings → Networking
2. **Copy the Public Domain URL** (e.g., `https://dex-production-6dd4.up.railway.app`)
3. **Test it**:
   ```bash
   curl https://your-backend-url.railway.app/health
   ```

### Step 2: Update Frontend Environment Variables

**If deployed on Railway:**

1. Go to **Frontend Service** → **Variables** tab
2. **Add or update** these variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
   INTERNAL_API_URL=https://your-backend-url.railway.app
   ```
3. **Replace** `your-backend-url.railway.app` with your actual backend URL from Step 1

**If running locally:**

1. Check `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   INTERNAL_API_URL=http://localhost:8000
   ```
2. Make sure your backend is running on port 8000

### Step 3: Verify Backend CORS Settings

1. Go to **Backend Service** → **Variables** tab
2. Check `BACKEND_CORS_ORIGINS` includes your frontend URL:
   ```
   BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in","https://your-frontend.railway.app"]
   ```

### Step 4: Check Browser Console

After updating environment variables and redeploying:

1. **Open browser DevTools** (F12)
2. **Go to Console tab**
3. **Log in with an OAuth provider** (GitHub, Google, or Azure)
4. **Look for these logs**:
   - `[NextAuth] API URL: ...` - Should show your backend URL, NOT localhost
   - `[NextAuth] Attempting to save user: ...`
   - `[NextAuth] Check user response status: ...`
   - `✅ Created user profile for: ...` (if successful)
   - `❌ Failed to save user to database: ...` (if failed)

### Step 5: Check Backend Logs

1. Go to **Railway Dashboard** → **Backend Service** → **Deployments** → **View Logs**
2. Look for:
   - `POST /api/v1/users` requests (user creation)
   - `POST /api/v1/users/email/{email}/update-login` requests (login updates)
   - Any database connection errors

### Step 6: Test API Directly

Test if the backend API is accessible:

```bash
# Replace with your actual backend URL
curl https://your-backend-url.railway.app/api/v1/users/email/test@example.com
```

Should return `404` (user not found) - this confirms the API is working.

## Common Issues

### Issue 1: API URL is localhost in production
**Symptom**: Console shows `[NextAuth] API URL: http://localhost:8000`
**Fix**: Set `NEXT_PUBLIC_API_URL` and `INTERNAL_API_URL` in Railway Variables

### Issue 2: CORS errors
**Symptom**: Console shows CORS errors
**Fix**: Add frontend URL to `BACKEND_CORS_ORIGINS` in backend variables

### Issue 3: Network errors
**Symptom**: Console shows `Failed to fetch` or network errors
**Fix**: 
- Verify backend URL is correct
- Check backend is running and accessible
- Test backend health endpoint

### Issue 4: 404 errors
**Symptom**: Console shows `404` for API calls
**Fix**: 
- Verify API URL includes `/api/v1` prefix
- Check backend routes are correct

## Verification

After fixing, test again:

1. **Log in with OAuth** (GitHub, Google, or Azure)
2. **Check browser console** for success messages
3. **Check database**:
   ```sql
   SELECT email, name, last_login, created_at 
   FROM users 
   ORDER BY created_at DESC;
   ```
4. **Should see your user** with `last_login` populated

## Enhanced Logging

I've added enhanced logging to the NextAuth callback. You'll now see:
- The API URL being used
- Each step of the user creation/update process
- Detailed error messages if something fails

Check your browser console after logging in to see what's happening!
