# Quick Domain Setup - dex.net.in

## Current Setup
- Frontend: `romantic-balance-production.up.railway.app`
- Backend: `dex-production-6dd4.up.railway.app`
- Domain: `dex.net.in`

---

## Quick Steps

### 1. Bind Frontend (2 min)
- Railway → Frontend Service → Settings → Networking
- Add Custom Domain: `dex.net.in`
- Copy DNS record

### 2. Bind Backend (2 min)
- Railway → Backend Service → Settings → Networking  
- Add Custom Domain: `api.dex.net.in`
- Copy DNS record

### 3. Update DNS (5 min)
At your domain registrar, add:
```
@    CNAME    (Railway frontend CNAME)
api  CNAME    (Railway backend CNAME)
www  CNAME    dex.net.in
```

### 4. Update Environment Variables (3 min)

**Frontend Variables:**
```
NEXTAUTH_URL=https://dex.net.in
NEXT_PUBLIC_API_URL=https://api.dex.net.in
INTERNAL_API_URL=https://api.dex.net.in
```

**Backend Variables:**
```
BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in"]
```

### 5. Update OAuth Callbacks
- GitHub: `https://dex.net.in/api/auth/callback/github`
- Google: `https://dex.net.in/api/auth/callback/google`
- Azure: `https://dex.net.in/api/auth/callback/azure-ad`

### 6. Wait & Test
- Wait 15-30 min for DNS
- Test: https://dex.net.in
- Test: https://api.dex.net.in/health

---

**Total Time: ~15 minutes + DNS propagation**
