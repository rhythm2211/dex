# DEX — Claude Code project context

See @README for overview. This file gives build commands and conventions for working in this repo.

## Project layout

- `frontend/` — Next.js 16 app (port 3000)
- `app/backend/` — FastAPI backend (default port 8000 or 8001 in Docker)
- `app/` — Python package root; set `PYTHONPATH` to `app` when running uvicorn locally
- `architecture.md`, `features.md`, `TROUBLESHOOTING.md` — design and ops docs

## Common commands

### Backend (from repo root)

```powershell
# From repo root; adjust path if your clone lives elsewhere
$env:PYTHONPATH = "$PWD\app"
Set-Location app
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Health: http://localhost:8000/health — API docs: http://localhost:8000/api/v1/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker quickstart

```bash
docker compose -f docker-compose.quickstart.yml up
```

### Python tests

```bash
cd app/backend
pytest
```

## Environment

- Backend env: `app/.env` (never commit; see README Configuration)
- Frontend env: `frontend/.env.local`
- Required keys include `GROQ_API_KEY` and Neo4j/Postgres settings for full stack

## Coding standards

- Match existing style in each area (Python backend vs TypeScript frontend)
- Minimize scope: focused diffs, no unrelated refactors
- Do not commit secrets, `.env` files, `app/backend/data/`, or `.next/`
- Only create git commits when explicitly requested
- AGPL-3.0 project — preserve license headers where present

## Architecture notes

- Ingestion builds AST + Neo4j dependency graph + pgvector embeddings
- Core domain: `app/backend/app/domain/` (graph engine, hybrid retriever)
- API routes: `app/backend/app/api/v1/`

## When stuck

- Check @TROUBLESHOOTING.md for backend connectivity, ports, and CORS
- Backend offline in UI usually means uvicorn not running or wrong `frontend/src/lib/api.ts` base URL
