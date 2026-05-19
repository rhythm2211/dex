# DEX

> Open-source codebase intelligence you can actually self-host.
> Real AST + dependency graph + grounded answers — no enterprise 
> sales call required.

[![Status](https://img.shields.io/badge/status-open%20beta-orange)](https://github.com/rhythm2211/dex)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/python-3.11+-blue)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/next.js-16+-black)](https://nextjs.org/)

> **Status:** Open beta, actively developed. [Issues](https://github.com/rhythm2211/dex/issues) and feedback welcome — especially the brutal kind.

<!-- Demo GIF placeholder — to be added before launch -->

## What is DEX?

When you ask Cursor or Copilot "how does this work?" they answer 
using vector search over text chunks. Fast, but they can invent 
function calls that don't exist and miss how files actually connect.

DEX builds a real structural map of your codebase: AST parsing 
via Tree-sitter, dependency graphs in Neo4j, hybrid retrieval, and 
LLM responses grounded in real file paths and line numbers. No 
hallucinated APIs. No invented callers.

It runs as a self-hosted web app on your machine or in your VPC. 
Your code never touches a third-party server. Open source under 
AGPL-3.0.

## Why DEX

| You are... | DEX is for you because... |
|---|---|
| A solo dev or small team priced out of enterprise tools | Free, AGPL-3.0, self-hosted in 60 seconds with Docker Compose. No sales call. No credit card. No seat minimum. Sourcegraph is enterprise-only at $49/user/month. Greptile is closed-source with enterprise-gated self-hosting. |
| Working on proprietary code that can't go to a SaaS | DEX runs entirely on your laptop or in your VPC. Audit every line of the codebase yourself. No code leaves your network. |
| Onboarding to a large or legacy codebase | Map structure visually, ask "how does X flow through this?" and get cited answers. Find circular dependencies and god objects automatically. |

## What you can do with DEX today

### Understand unfamiliar codebases

Ingest any repo via GitHub webhook. Ask questions in natural language:
- "How does authentication flow through this codebase?"
- "What files depend on the user model?"
- "Show me the main entry point and trace it through the layers."

Every answer cites real file paths and line numbers you can verify.

### Visualize structure with dependency graphs

Interactive Neo4j-backed graph viewer. Click any module, function, 
or file to see what depends on it and what it depends on. Trace 
features through the codebase from API endpoint to database query.

### Detect code health issues automatically

The health dashboard surfaces:
- Circular dependencies
- God objects (high coupling)
- Orphan code (unused files)
- Module-level coupling metrics

### Run entirely on your infrastructure

Self-host with Docker Compose. Your code never leaves the machine 
DEX runs on. AGPL-3.0 means you can audit every line of DEX itself.

## Roadmap

DEX is actively developed. Here's what's shipping next:

### Planned for Q2 2026
- **MCP server** for Cursor, Claude Code, and Windsurf — let your AI 
  coding assistant query DEX's dependency graph directly
- **BYO-LLM support** — use OpenAI, Anthropic, Azure OpenAI, or local 
  Ollama instead of (or alongside) Groq
- **VS Code extension** — codebase Q&A and impact analysis inside 
  your editor

### Planned for later
- Air-gapped self-host mode (works fully offline with local LLM)
- More language support beyond Python and JavaScript/TypeScript
- Managed cloud version (for teams that don't want to self-host)

Watch the repo or follow [@rhythmsuthar](https://github.com/rhythm2211) 
for updates.

## Why open-source matters here

Code intelligence requires deep access to your codebase. With DEX 
self-hosted, that code never leaves your infrastructure.

That matters when:
- You're working on proprietary IP your company won't let leave the 
  building
- You have compliance requirements (SOC 2, HIPAA, data residency, 
  air-gap)
- You want to audit the tool yourself before trusting it
- You don't want to depend on a startup's continued existence for a 
  critical workflow

DEX is licensed under AGPL-3.0. Free for self-host. The license 
prevents competitors from forking DEX into closed-source SaaS 
products. Commercial licenses are available for organizations that 
need different terms — contact rhythmsuthar123@gmail.com.

A managed cloud version of DEX is planned (see Roadmap) for teams 
who'd rather not operate the stack themselves. Both modes will use 
the same open-source core.

## Features

See [features.md](./features.md) for current capabilities (shipped) and roadmap (planned).

## How DEX is different

| Approach | What you get | Tradeoff |
|----------|--------------|----------|
| **GitHub Copilot / Cursor / Claude Code** | Fast in-editor help on open files and selections | LLM-first: limited repo-wide structure; can invent imports, callers, or APIs |
| **Sourcegraph** | Mature enterprise code search and navigation | Powerful, but heavier setup and cost; often overkill for small teams |
| **Greptile** | AI codebase Q&A with citations (closest to DEX's pitch) | Closed-source, cloud-hosted; not self-hostable on your infra |
| **repoingest / gitingest / repomix** | Whole-repo text dump into a prompt | Simple, but no AST or dependency graph; context limits and weak structure on large repos |
| **DEX** | AST + dependency graph + vector search → cited answers | **Open beta**, **open-source**, **self-hostable** — you operate the stack and keep code local |

**In short:** DEX gives you structural understanding of how code connects, with verifiable citations — without sending source to a closed SaaS.

## Architecture

DEX consists of three main components:

1. **Frontend** (Next.js 16 + TypeScript): React-based UI with D3.js visualizations
2. **Backend** (FastAPI + Python): REST API with RAG service, ingestion pipeline, and graph engine
3. **Databases**:
   - PostgreSQL + pgvector: Vector embeddings for semantic search
   - Neo4j: Graph database for code structure and dependencies

See [architecture.md](./architecture.md) for detailed architecture documentation.

## Prerequisites

- **Docker & Docker Compose** (recommended) or
- **Node.js 20+** and **Python 3.11+** (for manual setup)
- **PostgreSQL 16+** with pgvector extension
- **Neo4j** (Aura Cloud recommended) or self-hosted
- **API Keys**: GROQ_API_KEY (required), Neo4j credentials (required)

## Quick Start

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**:
```bash
git clone https://github.com/rhythm2211/dex.git
cd dex
```

2. **Configure environment**:
   - Create `app/.env` with backend environment variables
   - Create `frontend/.env.local` with frontend environment variables

3. **Start services**:
```bash
docker compose --env-file app/.env up -d
```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8001
   - API Docs: http://localhost:8001/api/v1/docs

### Option 2: Manual Setup

For detailed manual setup instructions, refer to the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide.

## Documentation

- **[features.md](./features.md)**: Complete feature list and capabilities
- **[architecture.md](./architecture.md)**: System architecture and design
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**: Common issues and solutions

## Configuration

### Environment Variables

**Backend** (`app/.env`):
```bash
# Required
POSTGRES_HOST=postgres
POSTGRES_PASSWORD=your_password
GROQ_API_KEY=your_groq_key
NEO4J_URI=neo4j+s://...
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# Optional
ENVIRONMENT=production
DEBUG=false
RESEND_API_KEY=your_resend_key
```

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret
```

## Usage

### Ingest a Repository

1. Navigate to the app dashboard
2. Enter a GitHub repository URL
3. Click "Ingest Repository"
4. Monitor progress in real-time

### Query the Codebase

1. Use the chat interface to ask natural language questions
2. Example queries:
   - "How does authentication work?"
   - "What files depend on the user model?"
   - "Show me the main entry point"

### Explore the Knowledge Graph

1. View the interactive graph visualization
2. Click nodes to see dependencies
3. Use the impact analysis to see upstream dependencies

### Health Dashboard

1. Navigate to the health dashboard
2. View code quality metrics:
   - Circular dependencies
   - God objects (high coupling)
   - Orphan code (unused files)

## Development

### Local Development

**Backend**:
```bash
cd app/backend
PYTHONPATH=. python -m uvicorn app.main:app --reload --port 8000
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend tests
cd app/backend
pytest

# Frontend tests
cd frontend
npm test
```

### CI/CD

DEX uses GitHub Actions for CI:

- Lint and test on every push/PR
- Docker image builds (publishing setup planned)
- Automated release tagging

## Security

- Input validation and sanitization
- CORS configuration
- Environment variable validation
- Secure authentication (NextAuth.js)
- Safe error handling (no sensitive data exposure)
- Health check endpoints for monitoring

## Deployment

DEX can be deployed using:

- **Docker Compose**: Simple single-server deployment
- **Cloud Platforms**: Vercel (frontend), Railway/Render (backend)
- **Databases**: PostgreSQL with pgvector, Neo4j Aura (cloud) or self-hosted

Operational features for self-hosted deployments:

- Safe error handling (no sensitive data exposure)
- Health check endpoints (`/health`)
- Environment-based configuration
- Security hardening (CORS, input validation, XSS protection)
- Structured logging
- Database connection retry logic
- Docker optimization

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for deployment guidance.

## Troubleshooting

Common issues and solutions:

- **Database connection errors**: Check credentials and network connectivity
- **CORS errors**: Verify `BACKEND_CORS_ORIGINS` configuration
- **Ingestion failures**: Check repository URL and GitHub token
- **High memory usage**: Adjust resource limits in `docker-compose.yml`

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed troubleshooting.

## Performance

- **Vector Search**: HNSW indexing for fast similarity search
- **Graph Queries**: Optimized Cypher queries with pagination
- **Lazy Loading**: On-demand graph expansion
- **Background Tasks**: Asynchronous ingestion with progress tracking
- **Connection Pooling**: Efficient database connections
- **Batch Processing**: Vector embeddings in batches of 100

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

DEX is licensed under **GNU AGPL-3.0** (see [LICENSE](LICENSE) for 
full terms).

### What this means in practice

- ✅ **Free for self-hosted use.** Run DEX on your own infrastructure, 
  for your own team's internal use, no cost.
- ✅ **Free for contributing back.** Fork, modify, submit PRs, build 
  on top — as long as derivative work stays AGPL-licensed.
- ✅ **Free for educational and research use.** No restrictions.
- ⚠️ **AGPL is "viral" for SaaS.** If you modify DEX and offer it as 
  a hosted service to others, you must release your modifications 
  under AGPL too.
- 💼 **Commercial licensing available.** If you want to embed DEX in 
  a closed-source product, offer DEX as a managed service to 
  customers, or otherwise cannot comply with AGPL-3.0, a commercial 
  license is available. Contact rhythmsuthar123@gmail.com.

### Coming soon

A managed cloud version of DEX (no self-hosting required) is in 
development for teams who want DEX without operating the 
infrastructure. Join the waitlist at [dex.net.in](https://dex.net.in).

## Acknowledgments

- **Groq**: LLM inference
- **Neo4j**: Graph database
- **PostgreSQL + pgvector**: Vector database
- **Next.js**: Frontend framework
- **FastAPI**: Backend framework
- **D3.js**: Graph visualization

## Support

- Documentation: See [architecture.md](./architecture.md) and [features.md](./features.md)
- Issues: Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Logs: `docker compose logs -f`

---

## Developed By

**Rhythm Suthar**  
Email: rhythmsuthar123@gmail.com
