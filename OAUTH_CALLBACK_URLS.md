# OAuth Callback URLs Reference

## Production URLs (dex.net.in)

### GitHub
- **Callback URL**: `https://dex.net.in/api/auth/callback/github`
- **Update at**: https://github.com/settings/developers
- **Field Name**: Authorization callback URL

### Google
- **Callback URL**: `https://dex.net.in/api/auth/callback/google`
- **Update at**: https://console.cloud.google.com/apis/credentials
- **Field Name**: Authorized redirect URIs

### Microsoft/Azure AD
- **Callback URL**: `https://dex.net.in/api/auth/callback/azure-ad`
- **Update at**: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
- **Field Name**: Redirect URIs

---

## Local Development URLs (localhost:3000)

### GitHub
- **Callback URL**: `http://localhost:3000/api/auth/callback/github`

### Google
- **Callback URL**: `http://localhost:3000/api/auth/callback/google`

### Microsoft/Azure AD
- **Callback URL**: `http://localhost:3000/api/auth/callback/azure-ad`

---

## Quick Links

- **GitHub OAuth Apps**: https://github.com/settings/developers
- **Google Cloud Console**: https://console.cloud.google.com/apis/credentials
- **Azure Portal**: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

---

## Notes

1. **Add both production AND local URLs** if you want to test locally
2. **Save changes** after updating each provider
3. **Wait 1-2 minutes** for changes to propagate
4. **Test the login** after updating to ensure it works

---

## Current Configuration

Based on your `.env.local`:
- **NEXTAUTH_URL**: `http://localhost:3000` (local) or `https://dex.net.in` (production)
- **OAuth Apps**:
  - GitHub ID: `Ov23liKpR3HBFLY15kPr`
  - Google Client ID: `600525518701-kt5td7rhj8gq2h0im6or01o4fo43r6dd.apps.googleusercontent.com`
  - Azure AD Client ID: `3fc064cd-ac9e-46ae-a1e0-6f5bbeb807d9`
