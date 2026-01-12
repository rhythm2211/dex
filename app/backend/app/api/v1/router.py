from typing import List, Optional, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

# --- Service Imports ---
from backend.app.domain.sql_engine import CognitiveSQLEngine
from backend.app.services.ingestion_service import IngestionService
from backend.app.services.rag_service import RAGService

api_router = APIRouter()

# --- Service Initialization ---
# We instantiate these once (Singleton pattern) to keep connections/models loaded.
sql_engine = CognitiveSQLEngine()
ingestion_service = IngestionService()
rag_service = RAGService()

# --- Data Models (Request/Response) ---

class SQLQueryRequest(BaseModel):
    text: str

class SQLQueryResponse(BaseModel):
    status: str
    sql_generated: Optional[str] = None
    data: List[Any] = []
    columns: List[str] = []
    error: Optional[str] = None

class IngestRequest(BaseModel):
    repo_path: str

class HybridRAGRequest(BaseModel):
    query: str

# --- Endpoints ---

@api_router.post("/query/sql", response_model=SQLQueryResponse)
async def execute_sql_query(request: SQLQueryRequest):
    """
    Executes a natural language query against the structured SQL database.
    Uses the Self-Correcting Cognitive Engine.
    """
    result = sql_engine.generate_and_execute(request.text)
    
    if result["status"] == "failed":
        raise HTTPException(status_code=400, detail=result["error"])
        
    return result

@api_router.post("/ingest")
async def trigger_ingestion(request: IngestRequest, background_tasks: BackgroundTasks):
    """
    Triggers the proprietary GraphRAG ingestion pipeline.
    Runs in the background to avoid blocking the API.
    """
    # Offload the heavy lifting (Semantic Chunking + Graph Construction)
    background_tasks.add_task(ingestion_service.process_repository, request.repo_path)
    
    return {
        "status": "accepted",
        "message": f"Ingestion started for {request.repo_path}. The Knowledge Graph is being constructed."
    }

@api_router.post("/query/hybrid")
async def execute_hybrid_query(request: HybridRAGRequest):
    """
    Performs 'Dual-Path' retrieval:
    1. Vector Search (Semantic Similarity)
    2. Knowledge Graph Traversal (Structural Relationships)
    """
    try:
        response = rag_service.answer_query(request.query)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hybrid Retrieval Failed: {str(e)}")