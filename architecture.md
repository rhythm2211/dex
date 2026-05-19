# DEX Architecture

## Overview

DEX is an open-source codebase intelligence platform you can self-host. 
It combines AST parsing (Tree-sitter), dependency graphs in Neo4j, 
vector search with pgvector, and Groq-powered generation to deliver 
grounded answers with file:line citations — without sending your 
source code to a third-party SaaS.

See [features.md](./features.md) for a complete list of features.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Landing    │  │   Dashboard  │  │   Graph Visualization│  │
│  │    Page      │  │   (App)      │  │   (D3.js)            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                  │                      │             │
│         └──────────────────┼──────────────────────┘             │
│                            │                                    │
│                    ┌───────▼────────┐                           │
│                    │   API Client   │                           │
│                    │  (api.ts)      │                           │
│                    └───────┬────────┘                           │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTP/REST
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Backend (FastAPI)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Router                            │  │
│  │  /api/v1/ingest, /query/hybrid, /graph/structure, etc.  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                 │
│         │                  │                  │                 │
│  ┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐         │
│  │ Ingestion   │  │   RAG        │  │   Graph      │         │
│  │  Service    │  │   Service    │  │   Engine     │         │
│  └──────┬──────┘  └───────┬──────┘  └───────┬──────┘         │
│         │                 │                  │                 │
└─────────┼─────────────────┼──────────────────┼─────────────────┘
          │                 │                  │
          │                 │                  │
┌─────────▼─────────┐ ┌─────▼──────┐  ┌──────▼──────────┐
│   PostgreSQL       │ │  Hybrid    │  │    Neo4j        │
│   (pgvector)       │ │  Retriever │  │  (Graph DB)     │
│                   │ └────────────┘  └──────────────────┘
│  - Code chunks    │
│  - Embeddings     │
│  - Semantic search│
└───────────────────┘
```

## Frontend Components

### 1. **Landing Page** (`/frontend/src/app/page.tsx`)
- **Purpose**: Marketing/landing page with feature showcase
- **Key Features**:
  - Hero section with command palette simulation
  - Feature grid (Bento layout)
  - Authentication status display
  - Navigation to signup/login

### 2. **Dashboard/App** (`/frontend/src/app/app/page.tsx`)
- **Purpose**: Main application interface for codebase interaction
- **Key Components**:
  - **Graph Visualization**: D3.js-based force-directed graph showing code structure
  - **Chat Interface**: RAG query interface for natural language questions
  - **Ingestion Control**: Trigger repository indexing
  - **Node Interaction**: Click nodes to explore dependencies

### 3. **API Client** (`/frontend/src/lib/api.ts`)
- **Purpose**: Centralized HTTP client for backend communication
- **Key Methods**:
  - `queryRAG(query: string)`: Send natural language queries
  - `triggerIngestion(repoUrl: string)`: Start repository indexing
  - `getIngestStatus()`: Poll ingestion progress
  - `getGraphData()`: Fetch knowledge graph structure
  - `getImpactGraph(fileId: string)`: Get dependency subgraph
  - `getGitHistory()`: Fetch commit timeline

### 4. **Authentication Flow**
- Uses NextAuth.js for session management
- User profiles stored in SQLite via backend API
- Onboarding flow (`/onboarding`) collects user profile data

## Backend Components

### 1. **Main Application** (`/app/backend/app/main.py`)
- **Framework**: FastAPI
- **Key Features**:
  - CORS middleware for frontend communication
  - Request interceptors for logging and metrics
  - Health check endpoint
  - API router registration

### 2. **API Router** (`/app/backend/app/api/v1/router.py`)
- **Endpoints**:
  - `POST /api/v1/ingest`: Trigger repository ingestion (background task)
  - `GET /api/v1/ingest/status`: Get ingestion progress
  - `POST /api/v1/query/hybrid`: Execute RAG query
  - `GET /api/v1/graph/structure`: Get full knowledge graph
  - `GET /api/v1/graph/impact`: Get dependency subgraph for a file
  - `GET /api/v1/graph/expand`: Lazy load node neighbors
  - `GET /api/v1/git/history`: Get commit timeline
  - `GET/POST/PUT /api/v1/users/*`: User profile management

### 3. **Ingestion Service** (`/app/backend/app/services/ingestion_service.py`)
- **Purpose**: Process repositories and build knowledge base
- **Key Features**:
  - **Multi-Language Support**: Processes 80+ file types across major programming languages
  - **Language-Aware Chunking**: Uses language-specific text splitters for optimal code segmentation
  - **Intelligent Cloning**: Timeout detection, progress tracking, and stuck operation handling
  - **Git Integration**: Full history analysis with bus factor risk scoring and line-level blame
- **Workflow**:
  1. **Clone Repository**: 
     - If URL provided, clone to temp directory with full history
     - Progress tracking with timeout detection (10 min total, 2 min progress timeout)
     - Git configuration for network timeouts and large repositories
     - Automatic cleanup on errors/timeouts
  2. **Git History Analysis**: 
     - Extract commit timeline across all branches
     - Calculate bus factor risk scores per file
     - Track file-level metadata (authors, commit counts, last modified)
     - Generate ownership and collaboration patterns
  3. **Multi-Language Code Parsing**: 
     - **Python**: Full AST parsing for classes, functions, imports
     - **Other Languages**: Regex-based structure extraction (JavaScript, TypeScript, Java, C/C++, Go, Rust, Ruby, PHP, etc.)
     - Extract classes, functions, methods, imports/dependencies
     - Build dependency graph with language-specific import resolution
     - Stream nodes/edges to Neo4j
  4. **Language-Specific Vector Embedding**: 
     - Use appropriate text splitter for each file type
     - Split code into semantically meaningful chunks
     - Generate embeddings (HuggingFace sentence-transformers/all-MiniLM-L6-v2)
     - Index in PostgreSQL (pgvector) with file type metadata
  5. **Status Updates**: Real-time progress tracking for frontend polling with detailed breakdowns

### 4. **RAG Service** (`/app/backend/app/services/rag_service.py`)
- **Purpose**: Answer natural language queries about codebase
- **Workflow**:
  1. **Hybrid Retrieval**: 
     - Vector search in PostgreSQL/pgvector (semantic similarity)
     - Graph traversal in Neo4j (structural context)
  2. **Context Fusion**: Combine code snippets + graph relationships
  3. **LLM Generation**: Use Groq (Llama 3.3 70B) to synthesize answer
  4. **Response Format**: Markdown-formatted technical explanation

### 5. **Graph Engine** (`/app/backend/app/domain/graph_engine.py`)
- **Purpose**: Manage Neo4j graph database operations with multi-language support
- **Key Features**:
  - **Language Detection**: Automatic language detection from file extensions
  - **Multi-Language Parsing**: Python AST + regex-based extraction for other languages
  - **Ownership Tracking**: Line-level git blame integration for function/class ownership
  - **Collaboration Analysis**: Track multiple authors per code unit
- **Key Operations**:
  - `extract_and_build()`: Parse code structure (AST for Python, regex for others) and create nodes/edges
  - `_detect_language()`: Identify programming language from file extension
  - `_extract_structure_regex()`: Extract classes, functions, imports using language-specific patterns
  - `_resolve_import_path()`: Resolve import paths for different languages
  - `_calculate_function_owner()`: Determine function ownership from git blame data
  - `upsert_node()`: Stream node to Neo4j with ownership and metadata
  - `upsert_edge()`: Create relationships (DEPENDS_ON, CONTAINS, DEFINES, IMPORTS)
  - `get_full_graph()`: Fetch graph for visualization
  - `get_impact_subgraph()`: Find upstream dependencies
  - `get_neighbors()`: Lazy load node children
  - `wipe_graph()`: Clear database for fresh ingestion

### 6. **Hybrid Retriever** (`/app/backend/app/domain/hybrid_retriever.py`)
- **Purpose**: Combine vector search + graph traversal for RAG
- **Algorithm**:
  1. **Vector Search**: Find top-k similar code chunks in PostgreSQL/pgvector
  2. **Anchor Extraction**: Extract file names from retrieved chunks
  3. **Graph Expansion**: Query Neo4j for structural relationships of anchor files
  4. **Context Assembly**: Return JSON with code_context + graph_context

## Data Flow

### Ingestion Flow

```
User Input (Repo URL)
    │
    ▼
Frontend: triggerIngestion()
    │
    ▼
Backend: POST /api/v1/ingest
    │
    ▼
Background Task: run_ingestion_sequence()
    │
    ├─► IngestionService.process_repository()
    │   │
    │   ├─► Clone repo (if URL)
    │   │   ├─► Validate repository URL
    │   │   ├─► Clone with progress tracking
    │   │   ├─► Timeout detection (10 min total, 2 min progress)
    │   │   └─► Git config for network timeouts
    │   │
    │   ├─► Analyze Git history → repo_history.json
    │   │   ├─► Process all branches and refs
    │   │   ├─► Calculate bus factor risk scores
    │   │   ├─► Track file-level metadata (authors, commits, dates)
    │   │   └─► Generate collaboration patterns
    │   │
    │   ├─► Scan repository for code files
    │   │   ├─► Support 80+ file extensions
    │   │   ├─► Code files: Python, JS/TS, Java, C/C++, Go, Rust, Ruby, PHP, etc.
    │   │   ├─► Web files: HTML, CSS, Vue, Svelte
    │   │   ├─► Data files: JSON, YAML, TOML
    │   │   ├─► Documentation: Markdown, RST, Text
    │   │   └─► Config files: Docker, Git, package managers
    │   │
    │   ├─► For each file:
    │   │   ├─► Detect language from extension
    │   │   ├─► Parse structure:
    │   │   │   ├─► Python: AST parsing (CodeStructureVisitor)
    │   │   │   └─► Others: Regex-based extraction
    │   │   ├─► Get git blame (for code files)
    │   │   ├─► Extract nodes (files, classes, functions, methods)
    │   │   ├─► Extract edges (imports, contains, defines)
    │   │   └─► Stream to Neo4j with ownership metadata
    │   │
    │   └─► Generate embeddings → PostgreSQL/pgvector
    │       ├─► Use language-specific text splitter
    │       ├─► Create semantically meaningful chunks
    │       └─► Batch insert with metadata
    │
    └─► RAGService.reload_knowledge_base()
        └─► HybridRetriever.reload_graph() (no-op for Neo4j)
```

### Query Flow

```
User Query (Natural Language)
    │
    ▼
Frontend: queryRAG()
    │
    ▼
Backend: POST /api/v1/query/hybrid
    │
    ▼
RAGService.answer_query()
    │
    ├─► HybridRetriever.retrieve()
    │   │
    │   ├─► Vector Search (PostgreSQL/pgvector)
    │   │   └─► Find top-k similar code chunks
    │   │
    │   ├─► Extract file anchors
    │   │
    │   └─► Graph Expansion (Neo4j)
    │       └─► Find relationships for anchor files
    │
    ├─► Parse contexts (code_context + graph_context)
    │
    ├─► Build prompt with both contexts
    │
    └─► LLM Generation (Groq)
        └─► Return formatted answer
```

### Graph Visualization Flow

```
Frontend: getGraphData()
    │
    ▼
Backend: GET /api/v1/graph/structure
    │
    ▼
GraphEngine.get_full_graph()
    │
    ├─► Cypher Query: MATCH (n:CodeNode) OPTIONAL MATCH (n)-[r]->(m)
    │
    └─► Transform to {nodes: [], links: []}
        │
        ▼
Frontend: buildHierarchy()
    │
    ├─► Convert flat graph → tree structure
    │
    └─► D3.js Force Graph Rendering
```

### Impact Analysis Flow

```
User Clicks File Node
    │
    ▼
Frontend: getImpactGraph(fileId)
    │
    ▼
Backend: GET /api/v1/graph/impact?file_id=...
    │
    ▼
GraphEngine.get_impact_subgraph()
    │
    ├─► Cypher Query: Find all nodes that DEPEND_ON target
    │   └─► MATCH (target)<-[:DEPENDS_ON]-(source)
    │
    └─► Return subgraph (blast radius visualization)
```

## Data Stores

### 1. **Neo4j (Graph Database)**
- **Purpose**: Store code structure and dependencies with ownership tracking
- **Schema**:
  - **Nodes**: `CodeNode` with properties:
    - `id`: Unique identifier (file path or `file::class::function`)
    - `name`: Display name
    - `type`: file, class, function, module
    - `last_author`: Git blame metadata (most recent author)
    - `last_modified`: Timestamp
    - `commit_count`: Churn metric
    - `bus_risk_score`: Risk score (0.0-1.0) indicating single-author dependency
    - `top_owner`: Primary author (highest commit count)
    - `collaborators`: List of all authors who contributed
    - `start_line`, `end_line`: Line numbers for functions/classes (for blame mapping)
  - **Relationships**:
    - `DEPENDS_ON`: Import/dependency relationships (cross-language support)
    - `IMPORTS`: Direct import relationships
    - `CONTAINS`: File contains class/function
    - `DEFINES`: Scope hierarchy

### 2. **PostgreSQL + pgvector (Vector Database)**
- **Purpose**: Semantic search over code chunks
- **Schema**: `document_vectors` table with:
  - `id`: Primary key (SERIAL)
  - `content`: Code chunk text
  - `embedding`: vector(384) - embeddings (sentence-transformers/all-MiniLM-L6-v2)
  - `metadata`: JSONB field containing:
    - `file_name`: Source file path
    - `source`: Full file path
  - `file_name`: TEXT (indexed for faster lookups)
  - `source`: TEXT
  - `created_at`: TIMESTAMP
  - **Indexes**: 
    - HNSW index on `embedding` for fast similarity search
    - GIN index on `metadata` for JSONB queries
    - B-tree index on `file_name`

### 3. **SQLite (User Database)**
- **Purpose**: Store user profiles
- **Schema**: `User` table with:
  - `id`: Primary key (email)
  - `email`: User email
  - `name`, `age`, `company`, `role`, `bio`: Profile fields
  - `profile_completed`: Boolean flag
  - `created_at`, `updated_at`: Timestamps

### 4. **Local JSON Files**
- **Purpose**: Store sequential, small data
- **Files**:
  - `repo_history.json`: Commit timeline for time-travel feature
  - `repo_graph.json`: (Legacy, replaced by Neo4j)

## Key Technologies

### Frontend
- **Next.js 16**: React framework with SSR
- **TypeScript**: Type safety
- **D3.js**: Graph visualization
- **Axios**: HTTP client
- **NextAuth.js**: Authentication
- **Tailwind CSS**: Styling

### Backend
- **FastAPI**: Python web framework
- **LangChain**: LLM orchestration with language-specific text splitters
- **Groq**: LLM provider (Llama 3.3 70B)
- **HuggingFace**: Embedding models (sentence-transformers/all-MiniLM-L6-v2)
- **PostgreSQL + pgvector**: Vector database with HNSW indexing
- **Neo4j**: Graph database (cloud or self-hosted)
- **GitPython**: Repository cloning with progress tracking
- **tree-sitter** (optional): Multi-language parsing (fallback to regex)
- **SQLAlchemy**: ORM for SQLite
- **psycopg**: PostgreSQL adapter for Python

## Environment Variables

### Backend
```bash
# Neo4j
NEO4J_URI=neo4j+s://...
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=...

# PostgreSQL + pgvector
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=dex
POSTGRES_VECTOR_TABLE=document_vectors

# LLM
GROQ_API_KEY=...
OPENAI_API_KEY=... (optional)

# CORS
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Frontend
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
INTERNAL_API_URL=http://dex-backend:8000  # Docker internal
```

## Deployment Architecture

### Docker Compose
- **Frontend Service**: Next.js on port 3000/3001
- **Backend Service**: FastAPI on port 8000/8001
- **Network**: Services communicate via Docker service names

### Deployment considerations

### Infrastructure
- **Neo4j**: Use Neo4j Aura (cloud) or self-hosted with proper security
- **PostgreSQL**: Use managed PostgreSQL (AWS RDS, Google Cloud SQL, Azure Database) with pgvector extension
- **Frontend**: Vercel/Netlify deployment or containerized deployment
- **Backend**: Container orchestration (K8s, ECS, etc.) with health checks and auto-scaling

### Operational features
- **Environment-based configuration**: Automatic detection of production vs development
- **Health check endpoints**: `/health` with database connectivity checks
- **Error handling**: Safe error messages (no sensitive data exposure)
- **Logging**: Structured logging with appropriate levels (WARNING in production)
- **Resource limits**: Docker resource constraints for stability
- **Input validation**: Security-focused validation for all user inputs
- **Connection retry logic**: Automatic retry for transient database failures
- **CORS security**: Properly configured CORS for deployed domains

### Deployment Options
1. **Docker Compose**: Simple deployment for single-server setups
2. **Kubernetes**: For scalable, multi-server deployments
3. **Cloud Platforms**: AWS ECS, Google Cloud Run, Azure Container Instances
4. **Serverless**: Frontend on Vercel, Backend on AWS Lambda/Google Cloud Functions (with modifications)

### Monitoring & Observability
- Health check endpoints for load balancer integration
- Structured logging for log aggregation systems
- Request ID tracking for distributed tracing
- Performance metrics headers (X-Request-ID, X-Process-Time)

## Security Considerations

1. **CORS**: Explicitly configured for frontend origins with environment-based settings
2. **Authentication**: NextAuth.js handles session management with OAuth and credentials
3. **Data Isolation**: Each ingestion wipes previous data (single-tenant)
4. **API Keys**: Stored in environment variables, never committed to version control
5. **Code Privacy**: Code processed in ephemeral containers (Docker)
6. **Input Validation**: All user inputs validated and sanitized
7. **Error Handling**: Deployed mode hides sensitive error details
8. **Secrets Management**: Environment variables with validation warnings
9. **HTTPS**: SSL/TLS required for production (via reverse proxy)
10. **Rate Limiting**: Recommended for production API endpoints
11. **SQL Injection Protection**: Parameterized queries via SQLAlchemy
12. **XSS Protection**: Input sanitization and proper content types

## Performance Optimizations

1. **Streaming**: Graph nodes streamed to Neo4j (no RAM accumulation)
2. **Lazy Loading**: Graph expansion on-demand (`/graph/expand`)
3. **Pagination**: Graph queries limited to 2000-2500 nodes
4. **Background Tasks**: Ingestion runs asynchronously with progress tracking
5. **Caching**: Vector store and graph DB serve as caches
6. **Batch Processing**: Vector embeddings uploaded in batches of 100
7. **pgvector Indexing**: HNSW index enables fast approximate nearest neighbor search
8. **Language-Specific Splitting**: Optimal chunking per language improves retrieval quality
9. **Timeout Management**: Prevents hanging operations with configurable timeouts
10. **Progress Monitoring**: Real-time progress updates with file type breakdowns
11. **Efficient File Scanning**: Parallel file type detection and loading

## Supported Languages

DEX supports **80+ file types** across major programming languages including:
- **Python**: Full AST parsing
- **JavaScript/TypeScript**: ES6+ syntax support
- **Java/Kotlin/Scala**: Package import resolution
- **C/C++**: Include dependency tracking
- **Go, Rust, Ruby, PHP**: Regex-based extraction
- **Web Technologies**: HTML, CSS, Vue, Svelte
- **Data Formats**: JSON, YAML, TOML
- **Documentation**: Markdown, RST, Text
- **Configuration**: Docker, Git, package managers

See [features.md](./features.md) for complete language support details.