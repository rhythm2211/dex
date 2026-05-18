# DEX Features

## Core Features

### 🔍 Semantic Code Search
- **Vector-based search** across codebases using PostgreSQL + pgvector
- **Hybrid RAG** (Retrieval-Augmented Generation) combining semantic search with graph traversal
- **Multi-language support** for 80+ file types
- **Context-aware results** that understand code semantics, not just keywords

### 📊 Knowledge Graph Visualization
- **Interactive D3.js graph** showing code structure and dependencies
- **Hierarchical tree view** with expandable/collapsible nodes
- **Node types**: Files, Classes, Functions, Modules, Folders
- **Dependency relationships**: DEPENDS_ON, IMPORTS, CONTAINS, DEFINES
- **Visual path highlighting** from root to selected node
- **Lazy loading** for efficient graph expansion
- **Orientation controls**: Horizontal and vertical tree layouts

### 🤖 AI-Powered Q&A
- **Natural language queries** answered using Groq (Llama 3.3 70B)
- **Hybrid retrieval** combining vector search and graph context
- **Markdown-formatted responses** with code examples
- **Chat history** with downloadable PDF transcripts
- **Context-aware answers** that understand codebase structure

### 📈 Code Health Dashboard
- **Automated detection** of code quality issues:
  - Circular dependencies
  - God objects (high coupling)
  - Orphan code (unused files)
- **Health metrics** and code quality scores
- **Visual indicators** for code health status

### 💥 Blast Radius (Impact Analysis)
- **Dependency visualization** showing all files affected by a change
- **Risk scoring algorithm** (0-100) for each affected node
- **Kill switch warnings** when risk exceeds threshold
- **Smart CI checklist** suggesting test files to run
- **Human routing** recommending code reviewers
- **RAG-powered analysis** for change impact questions

### 👥 Team Collaboration Insights
- **Team topology visualization** showing active development zones
- **Activity insights** with development patterns
- **Git history analysis** with bus factor risk scoring
- **Code ownership tracking** with line-level git blame
- **Collaboration patterns** across files and functions

### ⏱️ Time Travel (Evolution)
- **Browse codebase evolution** through git history
- **Commit timeline** visualization
- **File-level metadata**: authors, commit counts, last modified dates
- **Historical analysis** of code changes

### 🌐 Multi-Language Support
- **80+ file types** across major programming languages
- **Language-specific parsing**:
  - Python: Full AST parsing
  - JavaScript/TypeScript: ES6+ syntax support
  - Java/Kotlin/Scala: Package import resolution
  - C/C++: Include dependency tracking
  - Other languages: Regex-based extraction
- **Language-aware chunking** for optimal code segmentation

### 🔐 Authentication & User Management
- **NextAuth.js** integration with OAuth providers:
  - GitHub OAuth
  - Google OAuth
  - Credential-based signup/login
- **User profiles** with customizable fields
- **Onboarding flow** for new users
- **Session management** with secure cookies

## User Interface Features

### Dashboard (`/app`)
- **Dual-panel layout**: Graph visualization + Assistant sidebar
- **Tabbed interface**: Assistant and Details tabs
- **Interactive graph controls**:
  - Zoom and pan (mouse wheel, right-click, spacebar+drag)
  - Center tree view
  - Orientation toggle (horizontal/vertical)
- **Node interaction**:
  - Click to select and view details
  - Expand/collapse nodes
  - Chat about specific nodes
  - View blast radius for nodes
- **Real-time ingestion progress** with detailed status updates
- **Chat interface** with message history
- **Help guide** with interactive tutorials

### Health Dashboard (`/health`)
- Code quality metrics and analysis
- Visual health indicators
- Issue detection and recommendations

### Blast Radius (`/blast-radius`)
- Interactive impact analysis graph
- Risk score visualization
- Test file suggestions
- Code reviewer recommendations

### Evolution (`/evolution`)
- Git history timeline
- Commit visualization
- File change tracking

### Insights
- **Activity Insights** (`/insights/activity`): Development activity analytics
- **Team Insights** (`/insights/team`): Team collaboration analytics

### User Pages
- **Profile** (`/profile`): User profile management
- **Settings** (`/settings`): Account, security, notifications, preferences
- **Help** (`/help`): Comprehensive FAQ and documentation
- **About** (`/about`): Platform information
- **Security** (`/security`): Security information

## Technical Features

### Ingestion Pipeline
- **Repository cloning** with progress tracking and timeout detection
- **Git history analysis** with bus factor risk scoring
- **Multi-language code parsing** with AST and regex-based extraction
- **Vector embedding generation** using HuggingFace sentence-transformers
- **Graph database indexing** with Neo4j
- **Batch processing** for efficient data handling
- **Real-time progress updates** with file type breakdowns

### API Features
- **RESTful API** with FastAPI
- **Health check endpoints** for monitoring
- **Background task processing** for ingestion
- **Error handling** with production-safe messages
- **Request logging** with performance metrics
- **CORS configuration** for frontend integration

### Database Features
- **PostgreSQL + pgvector**: Vector embeddings with HNSW indexing
- **Neo4j**: Graph database for code structure and dependencies
- **SQLite**: User profile storage
- **Connection pooling** for efficient database access
- **Retry logic** for transient failures

### Performance Optimizations
- **Streaming** graph nodes to Neo4j (no RAM accumulation)
- **Lazy loading** for on-demand graph expansion
- **Pagination** for large graph queries
- **Batch processing** for vector embeddings
- **Language-specific text splitting** for optimal chunking
- **Timeout management** to prevent hanging operations

## Security Features
- **Input validation** and sanitization
- **CORS configuration** for production domains
- **Environment variable validation**
- **Secure authentication** with NextAuth.js
- **Production error handling** (no sensitive data exposure)
- **HTTPS support** via reverse proxy
- **SQL injection protection** via parameterized queries
- **XSS protection** with input sanitization

## Deployment Features
- **Docker support** with docker-compose
- **Production-ready** configuration
- **Health check endpoints** for load balancers
- **Structured logging** for log aggregation
- **Environment-based configuration**
- **Resource limits** and monitoring
- **CI/CD ready** with GitHub Actions support

## Engineering Intelligence Platform

- **GitHub PR integration**: Webhook `POST /api/v1/integrations/webhooks/github` (optional `X-Hub-Signature-256` when `GITHUB_WEBHOOK_SECRET` is set) posts sticky PR comments and a GitHub Check; link repos via `/api/v1/integrations/github/repos`.
- **Leadership dashboard** (`/insights/leadership`): Bus-factor trend, top-risk files, unowned surface %, PR throughput, architecture violation / incident counts, directory ownership heatmap and concentration alerts.
- **What-if simulation** (`GET /api/v1/insights/team/what-if-leaves`): Critical files if a person leaves + RAG handoff plan.
- **Weekly digest**: Celery beat (Monday 09:00 UTC) + Resend email + optional Slack webhook; user prefs at `/api/v1/digest/prefs` and Settings UI.
- **Architecture drift** (`dex.architecture.yaml`): Layer tagging on ingestion, `DEPENDS_ON` violation edges, `POST /api/v1/architecture/recompute`, weekly snapshots in Postgres.
- **Production-aware risk**: `POST /api/v1/observability/incidents/push` maps incidents to `CodeNode`; blast radius uses `prod_incidents_7d` multiplier.
- **Cross-repo workspaces**: `POST /api/v1/workspace` groups repos; Neo4j `Repo` + `SAME_WORKSPACE` + OpenAPI `ServiceEndpoint` / `EXPOSES`; extended blast radius across workspace.
