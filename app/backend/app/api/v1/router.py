import os
import json
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel

# --- Service Imports ---
from backend.app.services.ingestion_service import IngestionService
from backend.app.services.rag_service import RAGService
from backend.app.api.v1.endpoints.users import router as users_router

logger = logging.getLogger("dex-core")

api_router = APIRouter()

# Include user routes
api_router.include_router(users_router, tags=["users"])

# --- Singleton Services ---
ingestion_service = IngestionService()
rag_service = RAGService()

# --- Data Models ---
class IngestRequest(BaseModel):
    repo_path: str

class HybridRAGRequest(BaseModel):
    query: str

# --- Background Task Wrapper ---
def run_ingestion_sequence(repo_path: str):
    try:
        logger.info(f"🚀 Starting background ingestion for: {repo_path}")
        result = ingestion_service.process_repository(repo_path)
        
        if result.get("status") == "success":
            logger.info("💾 Ingestion processing done. Triggering RAG memory refresh...")
            rag_service.reload_knowledge_base()
            logger.info("✅ System fully updated.")
        else:
            logger.error(f"❌ Ingestion failed: {result.get('error')}")
    except Exception as e:
        logger.exception(f"Background task crashed: {e}")
        ingestion_service._update_status("error", 0, f"System Error: {str(e)}")

# --- Endpoints ---

@api_router.get("/health")
def health_check():
    return {"status": "ok", "version": "1.2.0 (Neo4j Cloud)"}

@api_router.get("/graph/structure")
def get_knowledge_graph():
    """
    Fetches the knowledge graph directly from Neo4j Cloud.
    Now supports massive datasets via smart limits.
    """
    try:
        # Default limit 2000 to prevent browser crash on initial load
        # You can implement lazy loading later if needed
        return ingestion_service.graph_engine.get_full_graph(limit=2500)
    except Exception as e:
        logger.error(f"Neo4j Read Error: {e}")
        return {"nodes": [], "links": []}

@api_router.get("/graph/impact")
def get_impact_graph(file_id: str = Query(..., description="The file ID (path) to analyze blast radius for")):
    """
    IMPACT RADAR: Queries Neo4j for the dependency subgraph.
    Returns: All files that depend on 'file_id' (Upstream Dependencies).
    """
    try:
        # Direct Cypher query via the GraphEngine
        return ingestion_service.graph_engine.get_impact_subgraph(file_id)
    except Exception as e:
        logger.error(f"Neo4j Impact Query Error: {e}")
        return {"nodes": [], "links": []}

@api_router.get("/git/history")
def get_git_history():
    """
    TIME TRAVEL: Returns the commit timeline for the slider.
    NOTE: History is still kept local (JSON) because it's sequential and small.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
    history_path = os.path.join(backend_root, "data", "repo_history.json")

    if not os.path.exists(history_path):
        return []

    try:
        with open(history_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"History read error: {e}")
        return []

@api_router.post("/ingest")
async def trigger_ingestion(request: IngestRequest, background_tasks: BackgroundTasks):
    current_status = ingestion_service.get_current_status()
    if current_status["state"] == "running":
         raise HTTPException(status_code=409, detail="An ingestion task is already running.")

    background_tasks.add_task(run_ingestion_sequence, request.repo_path)
    
    return {
        "status": "accepted",
        "message": f"Ingestion started for {request.repo_path}."
    }

@api_router.get("/ingest/status")
def get_ingestion_status():
    return ingestion_service.get_current_status()

@api_router.post("/query/hybrid")
def execute_hybrid_query(request: HybridRAGRequest):
    try:
        response = rag_service.answer_query(request.query)
        return response
    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/graph/expand")
def expand_graph_node(node_id: str = Query(..., description="The ID of the node to expand")):
    """
    LAZY LOADING: Fetches children of the specific node.
    Used for progressive rendering of large graphs.
    """
    try:
        return ingestion_service.graph_engine.get_neighbors(node_id)
    except Exception as e:
        logger.error(f"Graph Expansion Error: {e}")
        return {"nodes": [], "links": []}