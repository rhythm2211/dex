# Railway IPv6 Connection Issue - Fix Guide

## Problem

You're seeing errors like:
```
Failed to resolve db.zyrxhllgdgowsbjislaq.supabase.co to IPv4, using hostname
connection to server at "db.zyrxhllgdgowsbjislaq.supabase.co" (2406:da1a:...) failed: Network is unreachable
```

This happens because Railway's network environment resolves Supabase to IPv6, but Railway doesn't support IPv6 connections (or Supabase isn't reachable via IPv6 from Railway).

## Solutions (Try in Order)

### Solution 1: Enable Supabase IPv4 Add-on (Recommended)

Even though you're using the connection pooler (port 6543), you may still need the IPv4 add-on for Railway.

1. **Enable IPv4 Add-on in Supabase**:
   - Go to https://supabase.com/dashboard/project/zyrxhllgdgowsbjislaq/settings/addons
   - Find "IPv4" add-on
   - Click "Enable" or "Add"
   - Cost: $4/month

2. **Wait 2-3 minutes** for the add-on to activate

3. **Redeploy on Railway** (should happen automatically)

The IPv4 add-on provides a dedicated IPv4 endpoint that Railway can connect to.

### Solution 2: Check Supabase Network Restrictions

1. Go to Supabase Dashboard → Project Settings → Database
2. Scroll to **Network Restrictions**
3. Check if there are any IP restrictions
4. If restrictions exist:
   - Add Railway's IP ranges (if known)
   - Or temporarily disable restrictions to test
   - Railway IPs change, so restrictions might block connections

### Solution 3: Use Direct Connection (Alternative)

If the connection pooler still doesn't work:

1. **Enable IPv4 Add-on** (required for this solution)
2. **Update Railway Variables**:
   - Change `POSTGRES_PORT` from `6543` to `5432`
   - This uses direct connection instead of pooler
3. **Redeploy**

### Solution 4: Verify Connection Pooler Works

The connection pooler (port 6543) should work without IPv4 add-on, but Railway's network might have issues.

To test:
1. Keep `POSTGRES_PORT=6543` in Railway Variables
2. Check if connection works after enabling IPv4 add-on
3. If it works, the add-on fixed the issue
4. If it still doesn't work, try Solution 3 (direct connection)

## Verification

After applying a solution, check Railway logs. You should see:

✅ **Success**:
```
✅ Resolved db.zyrxhllgdgowsbjislaq.supabase.co to IPv4: [some IPv4 address]
Database connection: postgres@[IPv4]:6543/postgres
✅ Database initialized successfully
```

❌ **Still failing**:
- If you still see IPv6 addresses, the resolution is still failing
- Try enabling IPv4 add-on if you haven't already
- Check Supabase network restrictions

## Why This Happens

1. **Railway's DNS** resolves Supabase hostnames to IPv6 addresses
2. **Railway's network** doesn't support IPv6 (or Supabase isn't reachable via IPv6)
3. **Connection pooler** should help, but if DNS only returns IPv6, it still fails
4. **IPv4 add-on** provides a dedicated IPv4 endpoint that Railway can reach

## Cost Consideration

- **IPv4 Add-on**: $4/month (~$0.0055/hour)
- **Connection Pooler**: Free (included with Supabase)
- **Direct Connection**: Free (but requires IPv4 add-on for Railway)

For Railway deployments, the IPv4 add-on is usually necessary and worth the cost for reliable connections.
