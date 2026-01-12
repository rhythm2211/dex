# DEX App - Project Structure & Overview

## Project Overview

**DEX (Code Architect)** is an AI-powered codebase analysis and visualization platform that combines:
- **GraphRAG (Graph-based Retrieval Augmented Generation)**: Builds a knowledge graph from code repositories
- **Vector Search**: Semantic similarity search using Pinecone
- **Hybrid Retrieval**: Combines graph traversal and vector search for better context
- **Interactive Visualization**: Real-time knowledge graph visualization using react-force-graph-2d

## Architecture

### Backend (FastAPI)
```
app/backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── router.py          # Main API endpoints
│   ├── core/
│   │   └── config.py              # Settings & environment variables
│   ├── domain/
│   │   ├── graph_engine.py        # Knowledge graph construction
│   │   ├── hybrid_retriever.py    # Dual-path retrieval (graph + vector)
│   │   ├── semantic_splitter.py   # Intelligent code chunking
│   │   └── sql_engine.py          # SQL query generation
│   ├── services/
│   │   ├── ingestion_service.py   # Repository processing pipeline
│   │   └── rag_service.py         # RAG query processing
│   └── main.py                    # FastAPI application entry point
└── data/
    └── repo_graph.json            # Saved knowledge graph (generated)
```

### Frontend (Next.js + React)
```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Main dashboard with graph visualization
│   │   ├── layout.tsx             # Root layout
│   │   └── globals.css            # Global styles
│   └── lib/
│       └── api.ts                 # API client (singleton)
└── package.json
```

## Key Components

### 1. Ingestion Pipeline (`ingestion_service.py`)
- **Repository Cloning**: Automatically clones GitHub repositories
- **Document Loading**: Loads Python and Markdown files
- **Semantic Chunking**: Splits code intelligently using semantic boundaries
- **Graph Construction**: Extracts knowledge triples (head, relation, tail) using LLM
- **Vector Embedding**: Stores code chunks in Pinecone for semantic search
- **Memory Management**: Wipes old data when switching repositories

### 2. Graph Engine (`graph_engine.py`)
- **Knowledge Extraction**: Uses LLM (Groq/Llama) to extract relationships from code
- **NetworkX Graph**: Builds a directed graph of code relationships
- **Graph Serialization**: Saves graph in frontend-compatible format (string IDs)

### 3. Hybrid Retriever (`hybrid_retriever.py`)
- **Vector Search**: Semantic similarity search in Pinecone
- **Graph Traversal**: Explores relationships in the knowledge graph
- **Context Fusion**: Combines both retrieval methods for comprehensive answers

### 4. Frontend Dashboard (`page.tsx`)
- **Repository Input**: Enter GitHub URL to analyze
- **Query Interface**: Ask questions about codebase architecture
- **Graph Visualization**: Interactive force-directed graph using react-force-graph-2d
- **Real-time Updates**: Polls for graph data after ingestion

## Data Flow

```
1. User enters GitHub URL → Frontend
2. Frontend → POST /api/v1/ingest → Backend
3. Backend clones repository → Processes files
4. Builds knowledge graph → Saves to backend/data/repo_graph.json
5. Stores vectors in Pinecone
6. Frontend polls GET /api/v1/graph/structure
7. Graph renders in ForceGraph2D component
8. User queries → POST /api/v1/query/hybrid
9. Hybrid retrieval → RAG response
```

## Fixed Issues

### 1. **Graph Path Issues** ✅
- **Problem**: Relative paths caused graph file not found errors
- **Fix**: Use absolute paths, ensure `backend/data/` directory exists

### 2. **Repository Cloning** ✅
- **Problem**: Ingestion service expected local path, but received GitHub URLs
- **Fix**: Added `_clone_repository()` method to automatically clone GitHub repos

### 3. **Graph Data Format** ✅
- **Problem**: NetworkX returns numeric node indices, but frontend needs string IDs
- **Fix**: Transform graph data in `save_graph()` to ensure all nodes/links use string IDs

### 4. **Memory Not Refreshing** ✅
- **Problem**: Old graph data persisted when switching repositories
- **Fix**: 
  - Reset graph engine instance in `_wipe_knowledge_base()`
  - Delete graph file
  - Clear Pinecone index
  - Clean up temporary cloned directories

### 5. **Graph Rendering** ✅
- **Problem**: Graph not displaying due to data format mismatches
- **Fix**: 
  - Improved data transformation in frontend
  - Added validation for nodes/links
  - Better error handling and polling mechanism
  - Defensive checks in API endpoint

## API Endpoints

- `GET /health` - Health check
- `GET /api/v1/graph/structure` - Get knowledge graph data
- `POST /api/v1/ingest` - Trigger repository ingestion (background task)
- `POST /api/v1/query/hybrid` - Query codebase using hybrid retrieval

## Environment Variables

Required in `.env`:
```
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=your_index
GROQ_API_KEY=your_key
OPENAI_API_KEY=your_key (optional)
```

## Dependencies

### Backend
- FastAPI, Uvicorn
- LangChain (Groq, HuggingFace, Pinecone)
- NetworkX (graph operations)
- GitPython (repository cloning)
- Pinecone (vector database)

### Frontend
- Next.js 16
- React 19
- react-force-graph-2d (graph visualization)
- Axios (API client)
- Tailwind CSS (styling)

## Running the Application

### Backend
```bash
cd app/backend
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Usage

1. **Start both servers** (backend on :8000, frontend on :3000)
2. **Enter GitHub repository URL** in the dashboard
3. **Click refresh icon** to trigger ingestion
4. **Wait for graph to load** (ingestion runs in background)
5. **Query the codebase** using natural language
6. **Explore the knowledge graph** interactively

## Graph Visualization Features

- **Interactive nodes**: Drag to reposition
- **Force-directed layout**: Automatic positioning
- **Auto-zoom**: Fits graph to viewport
- **Node labels**: Hover to see module names
- **Real-time updates**: Graph refreshes after ingestion

## Troubleshooting

### Graph not rendering?
1. Check browser console for errors
2. Verify graph file exists at `app/backend/data/repo_graph.json`
3. Check API endpoint returns valid JSON
4. Ensure nodes have string IDs, not numeric

### Ingestion fails?
1. Check GitHub URL is valid and accessible
2. Verify GitPython is installed
3. Check Pinecone credentials
4. Review backend logs for errors

### Memory not refreshing?
1. Graph engine is reset on each ingestion
2. Old graph file is deleted
3. Pinecone index is cleared
4. Temporary directories are cleaned up
