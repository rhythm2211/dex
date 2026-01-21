# DEX Architecture Documentation

## Overview

DEX (Developer Experience) is a codebase intelligence platform that combines semantic search, graph-based dependency analysis, and AI-powered code understanding. The system uses a hybrid RAG (Retrieval-Augmented Generation) approach to provide context-aware answers about codebases.

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
- **Workflow**:
  1. **Clone Repository**: If URL provided, clone to temp directory
  2. **Git History Analysis**: Extract commit timeline and file metadata
  3. **AST Parsing**: For each Python file:
     - Extract classes, functions, imports
     - Build dependency graph
     - Stream nodes/edges to Neo4j
  4. **Vector Embedding**: 
     - Split code into chunks
     - Generate embeddings (HuggingFace)
     - Index in PostgreSQL (pgvector)
  5. **Status Updates**: Progress tracking for frontend polling

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
- **Purpose**: Manage Neo4j graph database operations
- **Key Operations**:
  - `extract_and_build()`: Parse AST and create nodes/edges
  - `upsert_node()`: Stream node to Neo4j
  - `upsert_edge()`: Create relationships (DEPENDS_ON, CONTAINS, etc.)
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
    │   ├─► Analyze Git history → repo_history.json
    │   ├─► For each Python file:
    │   │   ├─► Parse AST (CodeStructureVisitor)
    │   │   ├─► Extract nodes (files, classes, functions)
    │   │   ├─► Extract edges (imports, contains)
    │   │   └─► Stream to Neo4j (GraphEngine.upsert_node/edge)
    │   │
    │   └─► Generate embeddings → PostgreSQL/pgvector
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
- **Purpose**: Store code structure and dependencies
- **Schema**:
  - **Nodes**: `CodeNode` with properties:
    - `id`: Unique identifier (file path or `file::class::function`)
    - `name`: Display name
    - `type`: file, class, function, module
    - `last_author`: Git blame metadata
    - `last_modified`: Timestamp
    - `commit_count`: Churn metric
  - **Relationships**:
    - `DEPENDS_ON`: Import relationships
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
- **LangChain**: LLM orchestration
- **Groq**: LLM provider (Llama 3.3 70B)
- **HuggingFace**: Embedding models
- **PostgreSQL + pgvector**: Vector database (replaces Pinecone)
- **Neo4j**: Graph database
- **GitPython**: Repository cloning
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

### Production Considerations
- Neo4j: Use Neo4j Aura (cloud) or self-hosted
- PostgreSQL: Use managed PostgreSQL (AWS RDS, Google Cloud SQL, Azure Database) with pgvector extension
- Frontend: Vercel/Netlify deployment
- Backend: Container orchestration (K8s, ECS, etc.)

## Security Considerations

1. **CORS**: Explicitly configured for frontend origins
2. **Authentication**: NextAuth.js handles session management
3. **Data Isolation**: Each ingestion wipes previous data (single-tenant)
4. **API Keys**: Stored in environment variables
5. **Code Privacy**: Code processed in ephemeral containers (Docker)

## Performance Optimizations

1. **Streaming**: Graph nodes streamed to Neo4j (no RAM accumulation)
2. **Lazy Loading**: Graph expansion on-demand (`/graph/expand`)
3. **Pagination**: Graph queries limited to 2000-2500 nodes
4. **Background Tasks**: Ingestion runs asynchronously
5. **Caching**: Vector store and graph DB serve as caches
6. **Batch Processing**: Vector embeddings uploaded in batches of 100
7. **pgvector Indexing**: HNSW index enables fast approximate nearest neighbor search

## Future Enhancements

1. **Multi-language Support**: Currently Python-only, expand to TypeScript, Go, etc.
2. **Incremental Updates**: Support partial re-indexing on file changes
3. **Webhook Integration**: Auto-trigger ingestion on GitHub pushes
4. **Multi-repository**: Support multiple repos per user
5. **Collaboration**: Share graphs and queries with team
6. **Advanced Analytics**: Code quality metrics, dependency health scores
