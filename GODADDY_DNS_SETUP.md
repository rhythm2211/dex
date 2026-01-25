# GoDaddy DNS Setup for dex.net.in

## DNS Record from Railway

```
Type:    CNAME
Name:    @
Value:   8ehqe7ry.up.railway.app
```

---

## TTL (Time To Live) Settings

### Recommended TTL Values:

**For Initial Setup (First 24-48 hours):**
- **TTL: 300 seconds (5 minutes)** or **600 seconds (10 minutes)**
- ✅ Faster DNS propagation
- ✅ Easier to test and troubleshoot
- ✅ Changes reflect quicker

**After Setup is Stable:**
- **TTL: 3600 seconds (1 hour)** or **7200 seconds (2 hours)**
- ✅ Reduces DNS query load
- ✅ Better performance
- ✅ Standard for production

### GoDaddy TTL Options:

GoDaddy typically offers these TTL options:
- **300 seconds** (5 minutes) - Recommended for initial setup
- **600 seconds** (10 minutes) - Good balance
- **3600 seconds** (1 hour) - Standard production
- **7200 seconds** (2 hours) - Long-term stable
- **14400 seconds** (4 hours) - Very stable
- **86400 seconds** (24 hours) - Maximum

---

## Step-by-Step: Add DNS Record in GoDaddy

1. **Log in to GoDaddy**: https://www.godaddy.com/
2. **Go to My Products** → **Domains**
3. **Click on `dex.net.in`**
4. **Click "DNS" or "Manage DNS"**
5. **Click "Add" or "+" button**
6. **Fill in the record:**
   - **Type**: CNAME
   - **Name**: @ (or leave blank for root domain)
   - **Value**: `8ehqe7ry.up.railway.app`
   - **TTL**: **300** (or 600 for initial setup)
7. **Click "Save"**

---

## Complete DNS Records to Add

### 1. Root Domain (Frontend)
```
Type:    CNAME
Name:    @
Value:   8ehqe7ry.up.railway.app
TTL:     300 (or 600)
```

### 2. www Subdomain (Optional but Recommended)
```
Type:    CNAME
Name:    www
Value:   dex.net.in
TTL:     300 (or 600)
```

### 3. API Subdomain (Backend - if you set up api.dex.net.in)
```
Type:    CNAME
Name:    api
Value:   (Railway backend CNAME - get this from backend service)
TTL:     300 (or 600)
```

---

## Important Notes

### About TTL:
- ⏱️ **Lower TTL (300-600)** = Changes propagate faster (5-10 min)
- ⏱️ **Higher TTL (3600+)** = Changes take longer but reduce DNS load
- 💡 **Start with 300-600** for initial setup, then increase to 3600+ after everything works

### About DNS Propagation:
- Railway says "up to 72 hours" but usually works in **15-30 minutes**
- You can check propagation: https://www.whatsmydns.net/#CNAME/dex.net.in
- Railway will show "Active" when DNS is detected

### GoDaddy Specific:
- If GoDaddy doesn't show TTL option, it uses default (usually 3600)
- Some GoDaddy interfaces show TTL as "1 Hour", "2 Hours", etc.
- You can change TTL later if needed

---

## After Adding DNS Record

1. **Wait 15-30 minutes** for DNS propagation
2. **Check Railway Dashboard** → Frontend Service → Settings → Networking
3. **Look for "Active" status** next to your domain
4. **Test**: Visit https://dex.net.in in your browser

---

## Troubleshooting

### Domain not working after 30 minutes:
- ✅ Check DNS propagation: https://www.whatsmydns.net/#CNAME/dex.net.in
- ✅ Verify record in GoDaddy DNS settings
- ✅ Check Railway shows domain as "Active"
- ✅ Clear browser cache and try again

### TTL not showing in GoDaddy:
- ✅ Some GoDaddy interfaces hide TTL (uses default 3600)
- ✅ This is fine - default TTL works perfectly
- ✅ You can contact GoDaddy support to change it if needed

---

**Quick Summary:**
- **TTL: 300-600 seconds** for initial setup (recommended)
- **TTL: 3600 seconds** after everything is stable
- GoDaddy default TTL (if not shown) is usually fine
