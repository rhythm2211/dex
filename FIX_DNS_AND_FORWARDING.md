# Fix DNS and Remove Forwarding

## Problem
- Railway's CNAME value changed to: `exc1d4fs.up.railway.app`
- Domain forwarding is pointing to wrong port/URL
- Forwarding doesn't work properly with Railway

---

## Solution: Remove Forwarding, Use Proper DNS

### Step 1: Remove Domain Forwarding

1. **In GoDaddy:**
   - Go to DNS Management
   - Find the **Forwarding** section
   - **Delete or disable** the forwarding rule for `dex.net.in`
   - Forwarding doesn't work with Railway - we need proper DNS

---

### Step 2: Update www CNAME Record

1. **In GoDaddy DNS Management:**
   - Find the existing `www` CNAME record
   - **Click Edit**
   - **Update Value:**
     - **From**: `8ehqe7ry.up.railway.app` (or any old value)
     - **To**: `exc1d4fs.up.railway.app` ✅
   - **Keep:**
     - Type: CNAME
     - Name: www
     - TTL: 300
   - **Save**

---

### Step 3: Complete DNS Setup

**www CNAME Record:**
```
Type:    CNAME
Name:    www
Value:   exc1d4fs.up.railway.app
TTL:     300
```

**No forwarding needed!** Railway will handle everything through DNS.

---

### Step 4: Wait for Railway to Detect

1. **Wait 15-30 minutes** for DNS propagation
2. **Check Railway Dashboard:**
   - Frontend Service → Settings → Networking
   - Look for `www.dex.net.in`
   - Should show **"Active"** status (green checkmark)
3. **Test:**
   - Visit: https://www.dex.net.in
   - Should show your app (not "coming soon")

---

### Step 5: Set Up Root Domain (After www Works)

Once `www.dex.net.in` is working:

1. **In GoDaddy:**
   - Go to **Forwarding** section
   - Add forwarding:
     - **Forward from**: `dex.net.in` (leave www blank)
     - **Forward to**: `https://www.dex.net.in`
     - **Type**: Permanent (301)
     - **Enable**: Forward with masking
   - **Save**

2. **This will:**
   - Redirect `dex.net.in` → `https://www.dex.net.in`
   - Keep your domain in the URL
   - Work properly since www is using DNS (not forwarding)

---

## Why Forwarding to Railway URL Doesn't Work

- Forwarding bypasses Railway's domain detection
- Railway shows "coming soon" because it doesn't recognize forwarded domains
- Forwarding can cause port/URL issues
- **Solution**: Use DNS (CNAME) for www, then forward root domain to www

---

## Complete Setup

### Current Setup:
1. ✅ **www CNAME**: Points to `exc1d4fs.up.railway.app` (DNS record)
2. ❌ **Remove forwarding** to Railway URL
3. ✅ **Wait for Railway** to show "Active"
4. ✅ **Test**: https://www.dex.net.in

### After www Works:
1. ✅ **Add forwarding**: `dex.net.in` → `https://www.dex.net.in`
2. ✅ **Test**: https://dex.net.in (should redirect to www)

---

## Quick Action Items

1. **Remove forwarding** to Railway URL in GoDaddy
2. **Update www CNAME** to `exc1d4fs.up.railway.app`
3. **Wait 15-30 minutes**
4. **Check Railway** shows "Active" for www.dex.net.in
5. **Test**: https://www.dex.net.in
6. **Then add forwarding**: `dex.net.in` → `https://www.dex.net.in`

---

**Key Point**: Use DNS (CNAME) for www, NOT forwarding to Railway URL. Forwarding only works for redirecting root domain to www.
