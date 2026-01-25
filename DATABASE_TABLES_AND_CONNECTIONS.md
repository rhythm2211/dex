# Database Tables and Connections - Neon Database

This document explains all tables created in the Neon PostgreSQL database and how they're dynamically initialized and updated.

## Tables Created in Neon Database

### 1. **`users` Table** ✅
**Purpose**: Store user profiles and authentication data

**Schema**:
- `id` (String, Primary Key) - NextAuth user ID (email or provider ID)
- `email` (String, Unique, Indexed) - User email address
- `password_hash` (String, Nullable) - Hashed password for credentials auth
- `name` (String, Nullable) - User's display name
- `age` (Integer, Nullable) - User's age
- `company` (String, Nullable) - User's company
- `role` (String, Nullable) - User's role
- `bio` (String, Nullable) - User's bio
- `github_username` (String, Nullable, Indexed) - GitHub username for contributions
- `profile_completed` (Boolean, Default: False) - Profile completion status
- `is_active` (Boolean, Default: True, Indexed) - Account active status
- `last_login` (DateTime, Nullable, Indexed) - Last login timestamp
- `created_at` (DateTime, Auto) - Account creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

**Initialization**: 
- ✅ Created automatically on app startup via `init_db()` in `app/backend/app/models/user.py`
- ✅ Called from `app/backend/app/main.py` on startup (line 24)
- ✅ Uses SQLAlchemy `Base.metadata.create_all()` for dynamic table creation

**Updates on Login**:
- ✅ **Credentials Login**: `last_login` updated in `/api/v1/users/verify-credentials` endpoint (line 210)
- ✅ **OAuth Logins** (GitHub, Google, Azure): `last_login` updated via `/api/v1/users/email/{email}/update-login` endpoint
  - Called from NextAuth `signIn` callback in `frontend/src/app/api/auth/[...nextauth]/route.ts`
  - Updates both new and existing users

### 2. **`document_vectors` Table** ✅
**Purpose**: Store vector embeddings for semantic code search

**Schema**:
- `id` (SERIAL, Primary Key) - Auto-incrementing ID
- `content` (TEXT, Not Null) - Code chunk text
- `metadata` (JSONB) - Additional metadata (file_name, source, etc.)
- `embedding` (vector(384)) - Vector embedding (384 dimensions for all-MiniLM-L6-v2)
- `file_name` (TEXT) - Source file name
- `source` (TEXT) - Full file path
- `created_at` (TIMESTAMP, Default: CURRENT_TIMESTAMP) - Creation timestamp

**Indexes**:
- `document_vectors_embedding_idx` - HNSW index for fast similarity search
- `document_vectors_metadata_idx` - GIN index on JSONB metadata
- `document_vectors_file_name_idx` - B-tree index on file_name

**Initialization**:
- ✅ Created automatically on app startup via `init_db()` in `app/backend/app/models/user.py` (lines 125-180)
- ✅ Non-blocking: If pgvector extension isn't available, app still starts (logs warning)
- ✅ Also available via manual script: `python -m backend.app.scripts.setup_pgvector`

**Extension Required**:
- `vector` extension (pgvector) must be enabled in Neon Dashboard
- Enable via: Neon Dashboard → SQL Editor → `CREATE EXTENSION IF NOT EXISTS vector;`

## Dynamic Initialization Flow

### On App Startup (`app/backend/app/main.py`):
1. `init_db()` is called (line 24)
2. Database connection is tested with retry logic (3 attempts, 2s delay)
3. `users` table is created via SQLAlchemy
4. Missing columns are added via ALTER TABLE (idempotent)
5. `pgvector` extension is enabled (if available)
6. `document_vectors` table is created (if pgvector available)
7. Indexes are created for both tables

### On User Login:

#### Credentials Login:
1. User submits email/password via NextAuth
2. `/api/v1/users/verify-credentials` endpoint is called
3. Password is verified
4. `last_login`, `is_active`, and `updated_at` are updated (line 210-213)
5. Changes are committed to database

#### OAuth Login (GitHub/Google/Azure):
1. User authenticates via OAuth provider
2. NextAuth `signIn` callback is triggered
3. User is created/checked in database
4. `/api/v1/users/email/{email}/update-login` endpoint is called
5. `last_login`, `is_active`, and `updated_at` are updated
6. Changes are committed to database

## Connection Configuration

### Neon Database Connection:
- **Host**: `ep-damp-dream-ahsk1hhl-pooler.c-3.us-east-1.aws.neon.tech` (pooler endpoint)
- **Port**: `5432`
- **Database**: `neondb`
- **User**: `neondb_owner`
- **Connection Pooling**: Enabled via Neon pooler endpoint
- **SSL**: Required (`sslmode=require`)

### Connection String:
Generated dynamically in `app/backend/app/core/config.py`:
- URL-encodes password and username for special characters
- Handles IPv4/IPv6 resolution
- Adds Neon-specific parameters (endpoint ID, SSL mode)

## Verification Steps

### Check Tables Exist:
```sql
-- In Neon SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should return:
- `users`
- `document_vectors`

### Check User Table Structure:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

### Check pgvector Extension:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Check Last Login Updates:
```sql
SELECT email, last_login, is_active, updated_at
FROM users
ORDER BY last_login DESC
LIMIT 10;
```

## Troubleshooting

### Tables Not Created:
1. Check database connection in `.env` file
2. Verify Neon credentials are correct
3. Check app logs for initialization errors
4. Ensure `init_db()` is being called on startup

### Last Login Not Updating:
1. Check NextAuth callback is calling update-login endpoint
2. Verify API endpoint is accessible
3. Check backend logs for errors
4. Ensure user exists in database

### pgvector Not Working:
1. Enable extension in Neon Dashboard: `CREATE EXTENSION vector;`
2. Check if extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'vector';`
3. Verify table exists: `SELECT * FROM document_vectors LIMIT 1;`

## Summary

✅ **All tables are created dynamically** on app startup
✅ **User table is updated on every login** (credentials and OAuth)
✅ **Everything is connected** via SQLAlchemy and FastAPI endpoints
✅ **Database initialization is non-blocking** - app starts even if some setup fails
✅ **Idempotent migrations** - safe to run multiple times

The system is fully automated and requires no manual database setup beyond enabling the pgvector extension in Neon Dashboard.
