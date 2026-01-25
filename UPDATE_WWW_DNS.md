# Update www DNS Record - Correct Value

## Railway's New CNAME Value

Railway has generated a new CNAME target for `www.dex.net.in`:
- **Old value**: `8ehqe7ry.up.railway.app` ❌
- **New value**: `omotlx5q.up.railway.app` ✅

---

## Step-by-Step: Update DNS in GoDaddy

### 1. Edit Existing www Record

1. **Go to GoDaddy DNS Management**
2. **Find the existing `www` CNAME record**
3. **Click Edit** (or click on the record)
4. **Update the Value:**
   - **Change from**: `8ehqe7ry.up.railway.app`
   - **Change to**: `omotlx5q.up.railway.app`
5. **Keep other settings:**
   - Type: CNAME
   - Name: www
   - TTL: 300 (or 600)
6. **Save**

---

## Complete DNS Record

```
Type:    CNAME
Name:    www
Value:   omotlx5q.up.railway.app
TTL:     300
```

---

## After Updating

1. **Wait 15-30 minutes** for DNS propagation
2. **Check Railway Dashboard:**
   - Go to Frontend Service → Settings → Networking
   - Look for `www.dex.net.in`
   - Should show "Active" status (green checkmark)
3. **Test:**
   - Visit: https://www.dex.net.in
   - Should show your app (not "coming soon")

---

## Why the Value Changed

Railway generates a unique CNAME target for each custom domain. When you added `www.dex.net.in` in Railway, it created a new CNAME target (`omotlx5q.up.railway.app`) specifically for that subdomain.

---

## Next Steps

After www works:

1. **Set up root domain forwarding** (optional):
   - In GoDaddy: Forward `dex.net.in` → `https://www.dex.net.in`
   - Type: Permanent (301) with Forward with masking

2. **Update environment variables** in Railway:
   - `NEXTAUTH_URL=https://www.dex.net.in` (or `https://dex.net.in` if forwarding)
   - `NEXT_PUBLIC_API_URL=https://api.dex.net.in` (if you set up backend subdomain)

---

**Action Required**: Update the www CNAME value in GoDaddy to `omotlx5q.up.railway.app`
