# DEX — Open-source codebase intelligence

> AST + dependency graph + citations — for repos too big to read linearly.

[![Status](https://img.shields.io/badge/status-open%20beta-orange)](https://github.com/rhythm2211/dex)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/python-3.11+-blue)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/next.js-16+-black)](https://nextjs.org/)

> **Status:** DEX is in **open beta**, actively developed by a solo founder. Built with real workloads in mind. [Issues](https://github.com/rhythm2211/dex/issues) and feedback welcome — especially the brutal kind.

DEX is open-source codebase intelligence for teams working in large or legacy repos. Ask questions in plain English and get grounded answers with **file:line citations** — powered by hybrid RAG over AST parsing, dependency graphs, and semantic search. Self-hostable; your code stays on your infrastructure.

## Features

- **Semantic Code Search**: Vector-based semantic search across codebases using PostgreSQL + pgvector
- **Knowledge Graph Visualization**: Interactive D3.js graph showing code structure and dependencies
- **AI-Powered Q&A**: Natural language queries answered using Groq (Llama 3.3 70B) with hybrid RAG
- **Code Health Dashboard**: Automated detection of circular dependencies, god objects, and orphan code
- **Team Collaboration Insights**: Visualize team topology and active development zones
- **Time Travel**: Browse codebase evolution through git history
- **Multi-Language Support**: Processes 80+ file types across major programming languages
- **Authentication**: NextAuth.js with OAuth (GitHub, Google) and credential-based signup

See [features.md](./features.md) for a complete feature list.

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
