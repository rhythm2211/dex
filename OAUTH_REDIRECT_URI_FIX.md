# Fixing OAuth Redirect URI Mismatch Error

## Common Causes

1. **NEXTAUTH_URL doesn't match the actual URL you're accessing**
2. **Callback URL in OAuth provider doesn't match what NextAuth generates**
3. **Missing trailing slash or protocol mismatch (http vs https)**

## Quick Fix Steps

### Step 1: Identify Which URL You're Using

**Are you accessing:**
- Local development: `http://localhost:3000`?
- Production: `https://dex.net.in`?
- Railway preview: `https://romantic-balance-production.up.railway.app`?

### Step 2: Update NEXTAUTH_URL

Update `frontend/.env.local` to match the URL you're actually using:

**For Local Development:**
```env
NEXTAUTH_URL=http://localhost:3000
```

**For Production:**
```env
NEXTAUTH_URL=https://dex.net.in
```

**For Railway Preview:**
```env
NEXTAUTH_URL=https://romantic-balance-production.up.railway.app
```

### Step 3: Verify OAuth Provider Callback URLs

Make sure the callback URLs in your OAuth providers **exactly match** the pattern:
`{NEXTAUTH_URL}/api/auth/callback/{provider}`

#### GitHub
- **URL**: https://github.com/settings/developers
- **Callback URL must be**: `{NEXTAUTH_URL}/api/auth/callback/github`
- **Examples**:
  - Local: `http://localhost:3000/api/auth/callback/github`
  - Production: `https://dex.net.in/api/auth/callback/github`

#### Google
- **URL**: https://console.cloud.google.com/apis/credentials
- **Redirect URI must be**: `{NEXTAUTH_URL}/api/auth/callback/google`
- **Examples**:
  - Local: `http://localhost:3000/api/auth/callback/google`
  - Production: `https://dex.net.in/api/auth/callback/google`

#### Microsoft/Azure AD
- **URL**: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
- **Redirect URI must be**: `{NEXTAUTH_URL}/api/auth/callback/azure-ad`
- **Examples**:
  - Local: `http://localhost:3000/api/auth/callback/azure-ad`
  - Production: `https://dex.net.in/api/auth/callback/azure-ad`

### Step 4: Restart Your Server

After updating `NEXTAUTH_URL`:
1. **Stop your frontend server** (Ctrl+C)
2. **Restart it** (`npm run dev` or your deployment)
3. **Clear browser cache** or use incognito mode
4. **Try logging in again**

## Debugging

### Check What URL NextAuth is Using

Add this to your NextAuth route temporarily to see what URL it's generating:

```typescript
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('Callback URL:', `${process.env.NEXTAUTH_URL}/api/auth/callback/github`);
```

### Common Mistakes

1. ❌ **Trailing slash**: `https://dex.net.in/` vs `https://dex.net.in`
   - ✅ Use: `https://dex.net.in` (no trailing slash)

2. ❌ **Protocol mismatch**: Using `http://` in production
   - ✅ Use: `https://` for production

3. ❌ **Port mismatch**: `localhost:3000` vs `localhost:3001`
   - ✅ Match the port your app is actually running on

4. ❌ **Missing callback path**: Just `https://dex.net.in`
   - ✅ Must include: `https://dex.net.in/api/auth/callback/github`

## Testing

1. **Test locally first** with `http://localhost:3000`
2. **Add localhost callback URL** to all OAuth providers
3. **Test production** with `https://dex.net.in`
4. **Add production callback URL** to all OAuth providers

## Multiple Environments

If you need to support both local and production, add **both** callback URLs to each OAuth provider:

**GitHub Example:**
- `http://localhost:3000/api/auth/callback/github`
- `https://dex.net.in/api/auth/callback/github`

**Google Example:**
- `http://localhost:3000/api/auth/callback/google`
- `https://dex.net.in/api/auth/callback/google`

**Azure AD Example:**
- `http://localhost:3000/api/auth/callback/azure-ad`
- `https://dex.net.in/api/auth/callback/azure-ad`

## Still Not Working?

1. **Check browser console** for the exact error message
2. **Check server logs** for NextAuth debug output
3. **Verify NEXTAUTH_URL** is being read correctly
4. **Try incognito mode** to rule out cache issues
5. **Wait 1-2 minutes** after updating OAuth provider settings (they need time to propagate)
