# ✅ System Setup Complete

## Migration Summary

### ✅ Completed Migrations

1. **Pinecone → PostgreSQL/pgvector**
   - Vector storage now uses PostgreSQL with pgvector extension
   - All vector operations migrated to `document_vectors` table
   - HNSW indexes created for fast similarity search

2. **SQLite → PostgreSQL (User Storage)**
   - User data now stored in PostgreSQL `users` table
   - All SQLite-specific code removed
   - Connection pooling configured for better performance

3. **Frontend ↔ Backend Linking**
   - Docker Compose configured with proper service dependencies
   - Frontend connects to backend via `http://dex-backend:8000` (internal)
   - Frontend exposed on `http://localhost:3001` (external)
   - Backend exposed on `http://localhost:8001` (external)

## Current Architecture

```
┌─────────────────┐
│   Frontend      │  Port 3001 (host) → 3000 (container)
│   (Next.js)     │  Connects to: http://dex-backend:8000
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend       │  Port 8001 (host) → 8000 (container)
│   (FastAPI)     │  Connects to: postgres:5432
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │  Port 5435 (host) → 5432 (container)
│   + pgvector    │  Database: dex
│                 │  Tables: users, document_vectors
└─────────────────┘
```

## Database Setup

### PostgreSQL Container
- **Container**: `dex-postgres`
- **Image**: `pgvector/pgvector:pg16`
- **Port**: `5435:5432`
- **Database**: `dex`
- **User**: `postgres`
- **Password**: `dex_password`

### Tables Created

1. **`users`** - User profiles and authentication
   - Columns: id, email, name, age, company, role, bio, profile_completed, is_active, last_login, created_at, updated_at

2. **`document_vectors`** - Vector embeddings for code search
   - Columns: id, content, metadata (JSONB), embedding (vector(384)), file_name, source, created_at
   - Indexes: HNSW for similarity search, GIN for metadata, B-tree for file_name

## Environment Configuration

### Backend (.env)
```bash
# PostgreSQL Configuration
POSTGRES_HOST=localhost          # Use 'postgres' in Docker
POSTGRES_PORT=5435              # Use 5432 in Docker
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dex_password
POSTGRES_DB=dex
POSTGRES_VECTOR_TABLE=document_vectors

# Other required
GROQ_API_KEY=your_key
NEO4J_URI=your_neo4j_uri
NEO4J_USERNAME=your_neo4j_username
NEO4J_PASSWORD=your_neo4j_password
```

### Frontend
- `NEXT_PUBLIC_API_URL=http://localhost:8001` (for browser)
- `INTERNAL_API_URL=http://dex-backend:8000` (for server-side)

## Running the System

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
cd /home/user/Desktop/dex-app
docker compose --env-file app/.env up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Option 2: Manual Start

#### 1. Start PostgreSQL
```bash
docker start dex-postgres
# Or use docker-compose postgres service
```

#### 2. Start Backend
```bash
cd /home/user/Desktop/dex-app/app/backend
PYTHONPATH=/home/user/Desktop/dex-app/app/backend:$PYTHONPATH \
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 3. Start Frontend
```bash
cd /home/user/Desktop/dex-app/frontend
npm run dev
```

## Verification

### Test PostgreSQL Connection
```bash
cd /home/user/Desktop/dex-app/app
PYTHONPATH=/home/user/Desktop/dex-app/app/backend:$PYTHONPATH \
python3 -c "
from backend.app.models.user import get_db, User
db = next(get_db())
print(f'Users: {db.query(User).count()}')
"
```

### Test Backend Health
```bash
curl http://localhost:8001/health
```

### Test Frontend
```bash
# Open in browser
http://localhost:3001
```

## Service URLs

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8001
- **Backend Docs**: http://localhost:8001/api/v1/docs
- **PostgreSQL**: localhost:5435

## Important Notes

1. **Docker vs Local**: 
   - In Docker, use service names (`postgres`, `dex-backend`)
   - Locally, use `localhost` with mapped ports

2. **Database Migrations**:
   - Run `setup_pgvector.py` for vector table
   - Run `setup_users_table.py` for users table
   - Both are automatically created on first backend startup

3. **Data Persistence**:
   - PostgreSQL data stored in Docker volume `postgres_data`
   - Backend data in `./app/backend/data/`

4. **CORS Configuration**:
   - Backend allows: localhost:3000, localhost:3001, frontend:3000
   - Add more origins in `.env` if needed

## Troubleshooting

### PostgreSQL Connection Issues
```bash
# Check if container is running
docker ps | grep dex-postgres

# Check logs
docker logs dex-postgres

# Test connection
psql -h localhost -p 5435 -U postgres -d dex
```

### Backend Can't Connect to PostgreSQL
- Verify `POSTGRES_HOST` and `POSTGRES_PORT` in `.env`
- In Docker, use `postgres` as hostname
- Locally, use `localhost:5435`

### Frontend Can't Reach Backend
- Check `NEXT_PUBLIC_API_URL` in frontend
- Verify backend is running on port 8001
- Check CORS settings in backend

## Next Steps

1. ✅ PostgreSQL with pgvector - **DONE**
2. ✅ User storage in PostgreSQL - **DONE**
3. ✅ Frontend/Backend linking - **DONE**
4. 🚀 Ready to use! Start ingesting repositories and querying code.
