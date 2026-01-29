# Local Development Environment Configuration

## ✅ Environment Files Updated for Local Development

All environment files have been updated to use local development settings instead of production.

### Changes Made:

#### 1. **Backend Environment** (`app/.env`)
- ✅ **PostgreSQL**: Changed from Neon DB (production) to localhost
  - `POSTGRES_HOST=localhost` (was: `ep-damp-dream-ahsk1hhl-pooler.c-3.us-east-1.aws.neon.tech`)
  - `POSTGRES_PORT=5432` (was: 5432)
  - `POSTGRES_USER=postgres` (was: `neondb_owner`)
  - `POSTGRES_PASSWORD=dex_password` (was: production password)
  - `POSTGRES_DB=dex` (was: `neondb`)

- ✅ **CORS Origins**: Updated for local development
  - `BACKEND_CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]`
  - (was: production domains)

- ✅ **Frontend URL**: Updated to localhost
  - `FRONTEND_URL=http://localhost:3000` (was: `https://dex.net.in`)

- ✅ **Environment Settings**: Changed to development mode
  - `ENVIRONMENT=development` (was: `production`)
  - `DEBUG=true` (was: `false`)

- ✅ **Neo4j**: Kept as cloud (Aura) - unchanged
- ✅ **API Keys**: Kept existing keys - unchanged

#### 2. **Frontend Environment** (`frontend/.env.local`)
- ✅ **API URLs**: Changed to local backend
  - `NEXT_PUBLIC_API_URL=http://localhost:8000` (was: Railway production URL)
  - `INTERNAL_API_URL=http://localhost:8000` (was: Railway production URL)

- ✅ **NextAuth URL**: Changed to localhost
  - `NEXTAUTH_URL=http://localhost:3000` (was: `https://dex.net.in`)

- ✅ **OAuth Keys**: Kept existing keys - unchanged

---

## 🚀 Running Locally

### Prerequisites
1. **PostgreSQL** running locally on port 5432
   - Default credentials: `postgres` / `dex_password`
   - Database name: `dex`
   - Must have `pgvector` extension installed

2. **Neo4j** (using cloud Aura - no local setup needed)

### Start Services

#### Backend
```bash
cd app
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend
```bash
cd frontend
npm run dev
```

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/v1/docs
- **Health Check**: http://localhost:8000/health

---

## 🔄 Switching Back to Production

To switch back to production, update:

### `app/.env`
```bash
# Uncomment production database
POSTGRES_HOST=ep-damp-dream-ahsk1hhl-pooler.c-3.us-east-1.aws.neon.tech
POSTGRES_USER=neondb_owner
POSTGRES_PASSWORD=npg_5YQnb0maSDlx
POSTGRES_DB=neondb

# Update CORS
BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in"]

# Update environment
ENVIRONMENT=production
DEBUG=false
FRONTEND_URL=https://dex.net.in
```

### `frontend/.env.local`
```bash
NEXT_PUBLIC_API_URL=https://dex-production-6dd4.up.railway.app
INTERNAL_API_URL=https://dex-production-6dd4.up.railway.app
NEXTAUTH_URL=https://dex.net.in
```

---

## 📝 Notes

- **PostgreSQL**: Make sure your local PostgreSQL has the `pgvector` extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

- **Database Setup**: You may need to run migrations or setup scripts for the local database

- **Neo4j**: Still using cloud Aura instance - no changes needed

- **API Keys**: All API keys remain the same (Groq, GitHub, Voyage AI, etc.)

---

## ✅ Verification

After starting both services, verify:

1. **Backend Health**: 
   ```bash
   curl http://localhost:8000/health
   ```

2. **Frontend**: Open http://localhost:3000 in browser

3. **API Connection**: Frontend should successfully connect to backend at http://localhost:8000

4. **CORS**: No CORS errors in browser console
