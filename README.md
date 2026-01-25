# DEX - Developer Experience Platform

<!-- CI/CD enabled and tested -->

[![Production Ready](https://img.shields.io/badge/status-production%20ready-green)](https://github.com)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/python-3.11+-blue)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/next.js-16+-black)](https://nextjs.org/)

DEX (Developer Experience) is a production-grade codebase intelligence platform that combines semantic search, graph-based dependency analysis, and AI-powered code understanding. The system uses a hybrid RAG (Retrieval-Augmented Generation) approach to provide context-aware answers about codebases.

## 🚀 Features

- **🔍 Semantic Code Search**: Vector-based semantic search across codebases using PostgreSQL + pgvector
- **📊 Knowledge Graph Visualization**: Interactive D3.js graph showing code structure and dependencies
- **🤖 AI-Powered Q&A**: Natural language queries answered using Groq (Llama 3.3 70B) with hybrid RAG
- **📈 Code Health Dashboard**: Automated detection of circular dependencies, god objects, and orphan code
- **👥 Team Collaboration Insights**: Visualize team topology and active development zones
- **⏱️ Time Travel**: Browse codebase evolution through git history
- **🌐 Multi-Language Support**: Processes 80+ file types across major programming languages
- **🔐 Authentication**: NextAuth.js with OAuth (GitHub, Google) and credential-based signup

## 🏗️ Architecture

DEX consists of three main components:

1. **Frontend** (Next.js 16 + TypeScript): React-based UI with D3.js visualizations
2. **Backend** (FastAPI + Python): REST API with RAG service, ingestion pipeline, and graph engine
3. **Databases**:
   - PostgreSQL + pgvector: Vector embeddings for semantic search
   - Neo4j: Graph database for code structure and dependencies

See [architecture.md](./architecture.md) for detailed architecture documentation.

## 📋 Prerequisites

- **Docker & Docker Compose** (recommended) or
- **Node.js 20+** and **Python 3.11+** (for manual setup)
- **PostgreSQL 16+** with pgvector extension
- **Neo4j** (Aura Cloud recommended) or self-hosted
- **API Keys**: GROQ_API_KEY (required), Neo4j credentials (required)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**:
```bash
git clone <repository-url>
cd dex
```

2. **Configure environment**:
   - Create `app/.env` (see [SETUP.md](./SETUP.md#backend-environment-variables))
   - Create `frontend/.env.local` (see [SETUP.md](./SETUP.md#frontend-environment-variables))

3. **Start services**:
```bash
docker compose --env-file app/.env up -d
```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8001
   - API Docs: http://localhost:8001/api/v1/docs

### Option 2: Manual Setup

See [SETUP.md](./SETUP.md) for detailed manual setup instructions.

## 📚 Documentation

- **[SETUP.md](./SETUP.md)**: Comprehensive production deployment guide
- **[architecture.md](./architecture.md)**: System architecture and design
- **[README.DOCKER.md](./README.DOCKER.md)**: Docker-specific setup guide
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**: Common issues and solutions

## 🔧 Configuration

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

See [SETUP.md](./SETUP.md#environment-configuration) for complete configuration.

## 🎯 Usage

### 1. Ingest a Repository

1. Navigate to the app dashboard
2. Enter a GitHub repository URL
3. Click "Ingest Repository"
4. Monitor progress in real-time

### 2. Query the Codebase

1. Use the chat interface to ask natural language questions
2. Examples:
   - "How does authentication work?"
   - "What files depend on the user model?"
   - "Show me the main entry point"

### 3. Explore the Knowledge Graph

1. View the interactive graph visualization
2. Click nodes to see dependencies
3. Use the impact analysis to see upstream dependencies

### 4. Health Dashboard

1. Navigate to the health dashboard
2. View code quality metrics:
   - Circular dependencies
   - God objects (high coupling)
   - Orphan code (unused files)

## 🛠️ Development

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

DEX includes comprehensive CI/CD pipelines using GitHub Actions:

- **CI Pipeline**: Automated linting, testing, and building on every push/PR
- **Docker Build**: Automatic Docker image building and pushing to GitHub Container Registry
- **Deployment**: Automated deployment to staging and production environments
- **Release Management**: Automatic release creation on version tags

See [CI_CD.md](./CI_CD.md) for detailed CI/CD documentation and [.github/workflows/README.md](./.github/workflows/README.md) for workflow details.

## 🔒 Security

- Input validation and sanitization
- CORS configuration
- Environment variable validation
- Secure authentication (NextAuth.js)
- Production error handling (no sensitive data exposure)
- Health check endpoints for monitoring

See [SETUP.md](./SETUP.md#security-hardening) for production security guidelines.

## 🚀 Free Production Deployment

DEX can be deployed for **free** (except domain ~$1/month) using:
- **Frontend**: Vercel (free tier)
- **Backend**: Railway (free tier)
- **PostgreSQL**: Railway/Supabase/Neon (free tier)
- **Neo4j**: Neo4j Aura (free tier)

See **[FREE_HOSTING_GUIDE.md](./FREE_HOSTING_GUIDE.md)** for complete step-by-step instructions.

## 📊 Production Deployment

DEX is production-ready with:

- ✅ Production-grade error handling
- ✅ Health check endpoints
- ✅ Environment-based configuration
- ✅ Resource limits and monitoring
- ✅ Security hardening
- ✅ Database connection retry logic
- ✅ Input validation and sanitization
- ✅ Structured logging
- ✅ Docker optimization

See [SETUP.md](./SETUP.md) for complete production deployment guide.

## 🐛 Troubleshooting

Common issues and solutions:

- **Database connection errors**: Check credentials and network connectivity
- **CORS errors**: Verify `BACKEND_CORS_ORIGINS` configuration
- **Ingestion failures**: Check repository URL and GitHub token
- **High memory usage**: Adjust resource limits in `docker-compose.yml`

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed troubleshooting.

## 📈 Performance

- **Vector Search**: HNSW indexing for fast similarity search
- **Graph Queries**: Optimized Cypher queries with limits
- **Lazy Loading**: On-demand graph expansion
- **Background Tasks**: Asynchronous ingestion
- **Connection Pooling**: Efficient database connections

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

[Add your license here]

## 🙏 Acknowledgments

- **Groq**: LLM inference
- **Neo4j**: Graph database
- **PostgreSQL + pgvector**: Vector database
- **Next.js**: Frontend framework
- **FastAPI**: Backend framework
- **D3.js**: Graph visualization

## 📞 Support

- Documentation: See [SETUP.md](./SETUP.md) and [architecture.md](./architecture.md)
- Issues: Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Logs: `docker compose logs -f`

## 🗺️ Roadmap

- [ ] Incremental repository updates
- [ ] Webhook integration for auto-ingestion
- [ ] Multi-repository support
- [ ] Advanced analytics and metrics
- [ ] Real-time collaboration features
- [ ] Enhanced language support with tree-sitter

---

**Built with ❤️ for developers**
