# Fix "Record name www conflicts with another record" in GoDaddy

## Problem
- GoDaddy already has a `www` record in DNS
- You're trying to add a new CNAME for www
- GoDaddy doesn't allow duplicate records

---

## Solution: Edit or Delete Existing www Record

### Step 1: Find the Existing www Record

1. **In GoDaddy DNS Management:**
   - Look at your current DNS records
   - Find the existing `www` record
   - Check what Type it is (A, CNAME, etc.)
   - Check what Value it points to

### Step 2: Edit the Existing www Record

**Option A: Edit to Point to Railway**
1. **Click on the existing `www` record** (or click Edit)
2. **Change the Value to**: `8ehqe7ry.up.railway.app`
3. **Change Type to**: CNAME (if it's currently A record)
4. **Update TTL**: 600 seconds
5. **Save**

**Option B: Delete and Recreate**
1. **Delete the existing `www` record**
2. **Add new CNAME record:**
   - Type: CNAME
   - Name: www
   - Value: `8ehqe7ry.up.railway.app`
   - TTL: 600

---

## For Root Domain (@) - Alternative Solution

Since GoDaddy doesn't allow CNAME for root domain, try this:

### Option 1: Use GoDaddy Domain Forwarding (Easiest)

1. **In GoDaddy:**
   - Go to **DNS Management**
   - Find **"Forwarding"** section (usually at the top or bottom)
   - Click **"Add"** or **"Set Up"**
   - Configure:
     - **Forward from**: `dex.net.in` (leave www blank)
     - **Forward to**: `https://romantic-balance-production.up.railway.app`
     - **Forward type**: **Forward with masking** (important - keeps your domain in URL)
   - **Save**

2. **This will:**
   - Make `dex.net.in` work
   - Keep your domain in the browser URL
   - Work immediately (no DNS propagation needed)

### Option 2: Check for Existing @ Record

1. **Look at your DNS records**
2. **Find if there's already an `@` or blank name record**
3. **If it exists:**
   - Edit it to point to Railway's IP (if Railway provides A record)
   - Or delete it and add new one

---

## Recommended Setup

### For www Subdomain:
1. **Edit existing www record** → Point to `8ehqe7ry.up.railway.app`
2. **Type**: CNAME
3. **TTL**: 600

### For Root Domain (@):
1. **Use Domain Forwarding** (easiest option)
2. **Forward**: `dex.net.in` → `https://romantic-balance-production.up.railway.app`
3. **Type**: Forward with masking

---

## Complete Setup Steps

### 1. Fix www Record:
- Edit existing www record
- Change Value to: `8ehqe7ry.up.railway.app`
- Type: CNAME
- TTL: 600
- Save

### 2. Set Up Root Domain:
- Go to **Forwarding** section
- Add forwarding:
  - From: `dex.net.in`
  - To: `https://romantic-balance-production.up.railway.app`
  - Type: **Forward with masking**
- Save

### 3. Test:
- Wait 5-10 minutes
- Visit: https://dex.net.in
- Visit: https://www.dex.net.in
- Both should work!

---

## What to Do Right Now

1. **In GoDaddy DNS Management:**
   - Find the existing `www` record
   - **Edit it** (don't create new)
   - Change Value to: `8ehqe7ry.up.railway.app`
   - Change Type to: CNAME
   - TTL: 600
   - Save

2. **For root domain:**
   - Use **Domain Forwarding** feature
   - Forward `dex.net.in` to `https://romantic-balance-production.up.railway.app`
   - Use "Forward with masking"

---

**Quick Fix**: Edit the existing www record instead of creating a new one!
