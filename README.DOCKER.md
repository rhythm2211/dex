# Docker Setup Guide

This guide explains how to run the Dex application using Docker (frontend + backend).

## Prerequisites

- Docker + Docker Compose installed
- An environment file at `app/.env` (see “Environment variables” below)

## Project layout (important)

- `docker-compose.yml` lives in the repo root: `dex-app/docker-compose.yml`
- Backend build context is `dex-app/app` (Dockerfile at `app/backend/Dockerfile`)
- Frontend build context is `dex-app/frontend` (Dockerfile at `frontend/Dockerfile`)
- **Your `.env` is expected at** `dex-app/app/.env`

## Setup (step-by-step)

### 1) Create / verify `app/.env`

Make sure this file exists:

- `dex-app/app/.env`

Minimum required backend keys:

- `POSTGRES_HOST` (default: localhost)
- `POSTGRES_PORT` (default: 5432)
- `POSTGRES_USER` (default: postgres)
- `POSTGRES_PASSWORD` (required)
- `POSTGRES_DB` (default: dex)
- `POSTGRES_VECTOR_TABLE` (default: document_vectors)
- `GROQ_API_KEY`

Neo4j keys are optional unless you’re using the graph engine:

- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`

### 2) Build images (first build can take a long time)

The backend pulls large ML dependencies (Torch/CUDA wheels), so the **first build can take 10–30 minutes** depending on network + disk.

From the repo root:

```bash
docker compose --env-file app/.env build
```

### 3) Start containers

```bash
docker compose --env-file app/.env up -d
```

### 4) Verify it’s running

```bash
docker compose --env-file app/.env ps
curl -fsS http://localhost:8001/health
```

## Ports (current defaults)

This repo is configured to avoid common local port conflicts:

- **Frontend**: `http://localhost:3001` (host `3001` → container `3000`)
- **Backend API**: `http://localhost:8001` (host `8001` → container `8000`)
- **Backend docs**: `http://localhost:8001/api/v1/docs`

## Docker Commands

### Start services in detached mode:
```bash
docker compose --env-file app/.env up -d
```

### View logs:
```bash
docker compose --env-file app/.env logs -f
```

### View logs for a specific service:
```bash
docker compose --env-file app/.env logs -f backend
docker compose --env-file app/.env logs -f frontend
```

### Stop services:
```bash
docker compose --env-file app/.env down
```

### Stop and remove volumes:
```bash
docker compose --env-file app/.env down -v
```

### Rebuild after code changes:
```bash
docker compose --env-file app/.env up --build
```

## Services

### Backend
- **Internal port**: 8000
- **Host port**: 8001
- **Health Check**: http://localhost:8001/health
- **Build Context**: `./app`
- **Dockerfile**: `./app/backend/Dockerfile`

### Frontend
- **Internal port**: 3000
- **Host port**: 3001
- **Build Context**: `./frontend`
- **Dockerfile**: `./frontend/Dockerfile`

## Environment Variables

The following environment variables can be set in `app/.env`:

### Backend
- `POSTGRES_HOST` - PostgreSQL host (default: localhost)
- `POSTGRES_PORT` - PostgreSQL port (default: 5432)
- `POSTGRES_USER` - PostgreSQL user (default: postgres)
- `POSTGRES_PASSWORD` - PostgreSQL password (required)
- `POSTGRES_DB` - Database name (default: dex)
- `POSTGRES_VECTOR_TABLE` - Vector table name (default: document_vectors)
- `GROQ_API_KEY` - Required
- `GITHUB_TOKEN` - Optional
- `OPENAI_API_KEY` - Optional
- `NEO4J_URI` - Optional
- `NEO4J_USERNAME` - Optional
- `NEO4J_PASSWORD` - Optional
- `DATABASE_URL` - Default: `sqlite:///./dex.db`
- `BACKEND_CORS_ORIGINS` - Optional (see note below)

### Frontend
- `NEXT_PUBLIC_API_URL` - Backend API URL (currently set via compose to `http://localhost:8001`)

### Important note: `BACKEND_CORS_ORIGINS` must be JSON

Because `BACKEND_CORS_ORIGINS` is typed as a list in `pydantic-settings`, if you set it in an env file it **must be JSON**, for example:

```bash
BACKEND_CORS_ORIGINS=["http://localhost:3001","http://localhost:3000","http://frontend:3000"]
```

## Volumes

The backend data directory is mounted as a volume to persist data:
- `./app/backend/data` → `/app/backend/data` in container

## Troubleshooting

### Port already in use
If Docker fails with `address already in use`, something on your host is already listening on that port.

- Check who is using a port:

```bash
ss -ltnp | grep ':8000'
ss -ltnp | grep ':3000'
```

- Fix options:
  - Stop the local processes using those ports, OR
  - Change host ports in `docker-compose.yml` (example: `8002:8000`, `3002:3000`)

### Build fails
- Ensure all dependencies are properly listed in `requirements.txt` and `package.json`
- Check that Docker has enough resources allocated
- Try cleaning Docker cache: `docker system prune -a`

### CORS errors
The backend is configured to allow requests from:
- `http://localhost:3001` (current frontend host port)
- `http://localhost:3000` (if you run frontend locally)
- `http://frontend:3000` (Docker service name)
- Any origins specified in `BACKEND_CORS_ORIGINS` environment variable

### Environment variables not loading
- Make sure you’re running compose with the env file:

```bash
docker compose --env-file app/.env up -d
```

- Restart after editing env:

```bash
docker compose --env-file app/.env up -d --force-recreate
```
