# Running DEX App Locally (Without Docker)

This guide will help you run the backend and frontend locally for debugging.

## Prerequisites

1. **Python 3.11+** installed
2. **Node.js 18+** and npm installed
3. **PostgreSQL** running (can use Docker for just postgres, or local installation)
4. **Neo4j** credentials configured (if using Neo4j)

## Step 1: Start PostgreSQL (if not already running)

You can either:
- Keep using Docker for PostgreSQL: `docker-compose up -d postgres`
- Or use a local PostgreSQL installation

## Step 2: Setup Backend

```bash
# Navigate to app directory
cd /home/user/Desktop/dex-app/app

# Create virtual environment (if not exists)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Linux/Mac
# OR
# venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt

# Make sure you have a .env file in app/ directory
# Copy from app/.env.example if needed, or create one with:
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5435  # or 5432 if local postgres
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=dex_password
# POSTGRES_DB=dex
# NEO4J_URI=your_neo4j_uri
# NEO4J_USERNAME=your_neo4j_username
# NEO4J_PASSWORD=your_neo4j_password
# GROQ_API_KEY=your_groq_key
# GITHUB_TOKEN=your_github_token

# Set PYTHONPATH
export PYTHONPATH=/home/user/Desktop/dex-app/app:$PYTHONPATH

# Run backend
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend should start on `http://localhost:8000`

## Step 3: Setup Frontend

Open a new terminal:

```bash
# Navigate to frontend directory
cd /home/user/Desktop/dex-app/frontend

# Install dependencies (if not already done)
npm install

# Create .env.local file if it doesn't exist
# Add:
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXTAUTH_URL=http://localhost:3000
# (Add other auth keys as needed)

# Run frontend
npm run dev
```

The frontend should start on `http://localhost:3000`

## Step 4: Verify

1. Check backend health: `curl http://localhost:8000/health`
2. Check frontend: Open `http://localhost:3000` in browser
3. Try triggering ingestion from the frontend

## Troubleshooting

### Backend Issues

- **Import errors**: Make sure PYTHONPATH is set correctly
- **Database connection**: Check PostgreSQL is running and credentials in .env are correct
- **Port already in use**: Change port in uvicorn command or stop Docker containers

### Frontend Issues

- **API connection**: Make sure `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`
- **CORS errors**: Backend CORS is configured for localhost:3000, should work
- **Port conflicts**: Change port with `npm run dev -- -p 3001`

### Stop Docker Containers (if needed)

```bash
# Stop all containers
docker-compose down

# Or stop specific services but keep postgres
docker-compose stop backend frontend
```
