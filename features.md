# DEX Features

> Shipped capabilities vs planned work. For positioning, see [README.md](./README.md).

## Current capabilities

### Code understanding & Q&A

- **GitHub webhook ingestion** for repository cloning and indexing
- **Hybrid RAG**: pgvector semantic search + Neo4j graph context + Groq (Llama 3.3 70B) generation
- **Grounded responses** with file:line citations you can verify
- **AST parsing** via Tree-sitter for **Python, JavaScript, and TypeScript**
- **Additional file types**: lighter parsing (regex and language-specific heuristics) — not full AST parity with Python/JS/TS

### Dependency graph & visualization

- **Neo4j-backed graph**: files, classes, functions, modules, folders
- **Relationship types**: DEPENDS_ON, IMPORTS, CONTAINS, DEFINES
- **Interactive D3 graph** (dashboard): expand/collapse, horizontal/vertical layouts, lazy loading, zoom/pan
- **Blast radius / impact analysis**: affected files, risk scoring (0–100), kill-switch warnings, test-file suggestions, reviewer routing

### Code health

- **Automated detection**: circular dependencies, god objects (high coupling), orphan code (unused files)
- **Health dashboard** (`/health`) with metrics and visual indicators

### Self-host & operations

- **Docker Compose** deployment with health checks and env-based configuration
- **FastAPI REST API** with background ingestion tasks and safe error handling
- **Databases**: PostgreSQL + pgvector (HNSW embeddings), Neo4j (structure), SQLite (user profiles)
- **Performance**: streaming graph writes, batch embeddings, connection pooling, pagination for large graphs

### Authentication

- **NextAuth.js**: GitHub OAuth, Google OAuth, credential-based signup/login
- User profiles, onboarding flow, session management

### Web UI (shipped routes)

| Route | Purpose |
|-------|---------|
| `/app` | Graph visualization + AI assistant sidebar |
| `/health` | Code health metrics and issues |
| `/blast-radius` | Impact analysis graph and risk visualization |
| `/evolution` | Git history timeline and file-level metadata |
| `/insights/activity` | Development activity analytics |
| `/insights/team` | Team collaboration and ownership patterns |
| `/insights/leadership` | Bus-factor trends, risk files, ownership heatmap |
| `/profile`, `/settings`, `/help`, `/about`, `/security` | Account and documentation pages |

### Engineering intelligence (shipped; advanced)

These features exist in the codebase today but require additional configuration (webhooks, `dex.architecture.yaml`, observability feeds, etc.):

- **GitHub PR integration**: `POST /api/v1/integrations/webhooks/github` with optional signature verification; sticky PR comments and GitHub Checks; repo linking via `/api/v1/integrations/github/repos`
- **Leadership dashboard** (`/insights/leadership`): bus-factor trend, top-risk files, unowned surface %, PR throughput, architecture violation counts, directory ownership heatmap
- **Architecture drift** (`dex.architecture.yaml`): layer tagging on ingestion, `DEPENDS_ON` violation edges, `POST /api/v1/architecture/recompute`, weekly snapshots in Postgres
- **What-if simulation** (`GET /api/v1/insights/team/what-if-leaves`): critical files if a person leaves + RAG handoff plan
- **Weekly digest**: Celery beat (Monday 09:00 UTC) + Resend email + optional Slack webhook; prefs at `/api/v1/digest/prefs` and Settings UI
- **Production-aware risk**: `POST /api/v1/observability/incidents/push` maps incidents to code nodes; blast radius uses production incident multiplier
- **Cross-repo workspaces**: `POST /api/v1/workspace` groups repos; Neo4j `Repo` + `SAME_WORKSPACE`; extended blast radius across workspace

### Security

- Input validation and sanitization
- CORS configuration for deployed domains
- Environment variable validation
- Parameterized queries and XSS-conscious handling
- HTTPS via reverse proxy in production deployments

## Roadmap

### Planned for Q2 2026

- **MCP server** for Cursor, Claude Code, and Windsurf
- **BYO-LLM support** — OpenAI, Anthropic, Azure OpenAI, or local Ollama (alongside or instead of Groq)
- **VS Code extension** — codebase Q&A and impact analysis in the editor

### Planned for later

- Air-gapped self-host mode (fully offline with local LLM)
- Deeper multi-language AST beyond Python and JavaScript/TypeScript
- Managed cloud version ([dex.net.in](https://dex.net.in))

## Technical reference

### Ingestion pipeline

- Repository cloning with progress tracking and timeout detection
- Git history analysis with bus factor risk scoring
- Vector embedding generation (HuggingFace sentence-transformers)
- Graph indexing in Neo4j with real-time progress updates

### API

- RESTful FastAPI with OpenAPI docs at `/api/v1/docs`
- Health check endpoints for monitoring and load balancers
- Request logging with performance metrics

### Deployment

- Multi-stage Docker builds
- GitHub Actions CI (lint and test on push/PR)
- Structured logging for log aggregation
