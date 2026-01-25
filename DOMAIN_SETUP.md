# Domain Setup Guide - dex.net.in

## Current URLs
- **Frontend**: `https://romantic-balance-production.up.railway.app`
- **Backend**: `https://dex-production-6dd4.up.railway.app`
- **Custom Domain**: `dex.net.in`

---

## Step 1: Bind Frontend to dex.net.in

1. **Go to Railway Dashboard** → **Frontend Service**
2. Click **Settings** → **Networking**
3. Scroll to **Custom Domain** section
4. Click **"Add Custom Domain"**
5. Enter: `dex.net.in`
6. Railway will provide DNS records (CNAME or A record)
7. **Copy the DNS record** Railway gives you (you'll need it in Step 3)

---

## Step 2: Bind Backend (Optional - Recommended)

You have two options:

### Option A: Use Subdomain (Recommended)
- Bind backend to: `api.dex.net.in`
- This keeps frontend and backend separate

### Option B: Use Same Domain
- Bind backend to: `dex.net.in` 
- You'll need to route `/api` to backend (requires reverse proxy setup)

**For now, let's use Option A (api.dex.net.in):**

1. **Go to Railway Dashboard** → **Backend Service**
2. Click **Settings** → **Networking**
3. Scroll to **Custom Domain** section
4. Click **"Add Custom Domain"**
5. Enter: `api.dex.net.in`
6. **Copy the DNS record** Railway gives you

---

## Step 3: Update DNS Records

Go to your domain registrar (where you manage dex.net.in) and add these DNS records:

### For Frontend (dex.net.in):
- **Type**: CNAME (or A record if Railway provides an IP)
- **Name**: @ (or leave blank for root domain)
- **Value**: Railway's CNAME target (e.g., `cname.railway.app`)

### For Backend (api.dex.net.in):
- **Type**: CNAME (or A record if Railway provides an IP)
- **Name**: api
- **Value**: Railway's CNAME target for backend

### Also add www subdomain:
- **Type**: CNAME
- **Name**: www
- **Value**: `dex.net.in` (points to root domain)

**Example DNS Records:**
```
Type    Name    Value
CNAME   @       cname.railway.app (from Railway frontend)
CNAME   api     cname.railway.app (from Railway backend)
CNAME   www     dex.net.in
```

**Note:** DNS propagation can take 5 minutes to 48 hours, but usually works within 15-30 minutes.

---

## Step 4: Update Frontend Environment Variables

Once DNS is working (you can access https://dex.net.in):

1. **Go to Frontend Service** → **Variables** tab
2. Update:
   ```
   NEXTAUTH_URL=https://dex.net.in
   NEXT_PUBLIC_API_URL=https://api.dex.net.in
   INTERNAL_API_URL=https://api.dex.net.in
   ```

3. Railway will automatically redeploy

---

## Step 5: Update Backend CORS Settings

1. **Go to Backend Service** → **Variables** tab
2. Add or update:
   ```
   BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in","https://romantic-balance-production.up.railway.app"]
   ```

3. Railway will automatically redeploy

---

## Step 6: Update OAuth Callback URLs

Update your OAuth provider settings with the new domain:

### GitHub:
1. Go to: https://github.com/settings/developers
2. Select your OAuth App
3. Update **Authorization callback URL** to: `https://dex.net.in/api/auth/callback/github`
4. Save

### Google:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client
3. Add to **Authorized redirect URIs**: `https://dex.net.in/api/auth/callback/google`
4. Save

### Azure AD:
1. Go to Azure Portal → App registrations
2. Select your app
3. Add to **Redirect URIs**: `https://dex.net.in/api/auth/callback/azure-ad`
4. Save

---

## Step 7: Verify Everything Works

### Test Frontend:
```powershell
# Test frontend
Invoke-WebRequest -Uri "https://dex.net.in" -UseBasicParsing
```

### Test Backend:
```powershell
# Test backend
Invoke-WebRequest -Uri "https://api.dex.net.in/health" -UseBasicParsing
```

### Test in Browser:
1. Visit: https://dex.net.in
2. Open browser console (F12)
3. Try logging in
4. Check for CORS errors (should be none)
5. Test API calls

---

## Troubleshooting

### Domain not working:
- ✅ Wait 15-30 minutes for DNS propagation
- ✅ Check DNS records: `nslookup dex.net.in`
- ✅ Verify Railway shows domain as "Active" in Networking settings
- ✅ Check SSL certificate is active (Railway handles this automatically)

### CORS errors:
- ✅ Verify `BACKEND_CORS_ORIGINS` includes `https://dex.net.in`
- ✅ Check backend is accessible: `curl https://api.dex.net.in/health`
- ✅ Verify frontend `NEXT_PUBLIC_API_URL` is set to `https://api.dex.net.in`

### OAuth not working:
- ✅ Verify callback URLs are updated in OAuth provider settings
- ✅ Check `NEXTAUTH_URL` is set to `https://dex.net.in`
- ✅ Clear browser cookies and try again

---

## Quick Checklist

- [ ] Frontend bound to `dex.net.in` in Railway
- [ ] Backend bound to `api.dex.net.in` in Railway
- [ ] DNS records added at domain registrar
- [ ] Waited 15-30 minutes for DNS propagation
- [ ] Updated `NEXTAUTH_URL` to `https://dex.net.in`
- [ ] Updated `NEXT_PUBLIC_API_URL` to `https://api.dex.net.in`
- [ ] Updated `BACKEND_CORS_ORIGINS` in backend
- [ ] Updated OAuth callback URLs
- [ ] Tested frontend: https://dex.net.in
- [ ] Tested backend: https://api.dex.net.in/health
- [ ] Tested login and API calls

---

**Congratulations!** Your app should now be live at https://dex.net.in 🎉
