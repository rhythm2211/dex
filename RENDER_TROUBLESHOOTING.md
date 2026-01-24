# Render Troubleshooting Guide

## Current Issue: IPv6 Connection Error

You're seeing:
```
Failed to resolve db.zyrxhllgdgowsbjislaq.supabase.co to IPv4
connection to server at "db.zyrxhllgdgowsbjislaq.supabase.co" (2406:da1a:...) failed: Network is unreachable
```

## Quick Fixes

### Fix 1: Verify POSTGRES_PORT is Set

**Problem**: Error shows port 5432, but should be 6543 (connection pooler)

**Solution**:
1. Go to Render Dashboard → Your Service → Environment tab
2. Check if `POSTGRES_PORT` exists
3. If missing or wrong, add/update:
   - Key: `POSTGRES_PORT`
   - Value: `6543`
4. Save and redeploy

### Fix 2: Enable Supabase IPv4 Add-on

Even Render may need the IPv4 add-on for reliable connections.

1. **Enable IPv4 Add-on**:
   - Go to https://supabase.com/dashboard/project/zyrxhllgdgowsbjislaq/settings/addons
   - Find "IPv4" add-on
   - Click "Enable"
   - Cost: $4/month

2. **Wait 2-3 minutes** for activation

3. **Redeploy on Render** (should happen automatically)

### Fix 3: Check All Environment Variables

Make sure ALL these are set in Render Dashboard:

**Required Variables**:
- ✅ `POSTGRES_HOST=db.zyrxhllgdgowsbjislaq.supabase.co`
- ✅ `POSTGRES_PORT=6543` ← **CRITICAL: Make sure this is set!**
- ✅ `POSTGRES_USER=postgres`
- ✅ `POSTGRES_PASSWORD=[@Muj219302335]`
- ✅ `POSTGRES_DB=postgres`
- ✅ `GROQ_API_KEY=...`
- ✅ `GITHUB_TOKEN=...`
- ✅ `NEO4J_URI=...`
- ✅ `NEO4J_PASSWORD=...`

### Fix 4: Check Supabase Network Restrictions

1. Go to Supabase Dashboard → Project Settings → Database
2. Scroll to **Network Restrictions**
3. If restrictions exist:
   - Temporarily disable to test
   - Or add Render IP ranges (if known)

## Verification Steps

After applying fixes:

1. **Check Render Logs**:
   - Should see: `✅ Resolved db.zyrxhllgdgowsbjislaq.supabase.co to IPv4: [IPv4 address]`
   - Should see: `Database connection: postgres@[IPv4]:6543/postgres`
   - Should see: `✅ Database initialized successfully`

2. **Test Health Endpoint**:
   ```bash
   curl https://dex-z1v1.onrender.com/health
   ```

3. **Check Database Connection**:
   - Try creating a user via API
   - Check if database operations work

## Common Issues

### Issue: "No open ports detected"

**Cause**: Render is scanning for ports, but your app uses the PORT env var  
**Fix**: This is normal - Render assigns port automatically (you saw port 10000). The app is running correctly.

### Issue: Port 5432 instead of 6543

**Cause**: `POSTGRES_PORT` environment variable not set or wrong value  
**Fix**: Set `POSTGRES_PORT=6543` in Render Dashboard → Environment tab

### Issue: IPv6 connection failures

**Cause**: Render's network resolves Supabase to IPv6, but connection fails  
**Solutions**:
1. Enable Supabase IPv4 add-on (recommended)
2. Check Supabase network restrictions
3. Try direct connection (port 5432) with IPv4 add-on enabled

## Still Not Working?

If all fixes above don't work:

1. **Check Render Logs** for specific error messages
2. **Verify Supabase is accessible**:
   - Test connection from your local machine
   - Check Supabase dashboard for any alerts
3. **Try Direct Connection**:
   - Change `POSTGRES_PORT=5432` in Render
   - Make sure IPv4 add-on is enabled in Supabase
4. **Contact Support**:
   - Render: https://render.com/docs/support
   - Supabase: Check their status page

## Success Indicators

✅ **Working correctly**:
- `✅ Resolved ... to IPv4: [IPv4 address]`
- `Database connection: postgres@[IPv4]:6543/postgres`
- `✅ Database initialized successfully`
- Health endpoint returns 200

❌ **Still failing**:
- IPv6 addresses in connection attempts
- "Network is unreachable" errors
- Port 5432 being used (should be 6543)
