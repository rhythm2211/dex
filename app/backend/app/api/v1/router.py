import os
import json
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

# --- Service Imports ---
from backend.app.services.ingestion_service import IngestionService
from backend.app.services.rag_service import RAGService

logger = logging.getLogger("dex-core")

api_router = APIRouter()

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

@api_router.get("/graph/structure")
def get_knowledge_graph():
    """
    Returns graph JSON for Frontend Visualization.
    """
    # 1. BULLETPROOF PATH RESOLUTION
    # We find the file relative to the 'backend/data' folder, wherever it may be.
    # Current file: backend/app/api/v1/router.py
    # We need:      backend/data/repo_graph.json
    
    current_dir = os.path.dirname(os.path.abspath(__file__)) # .../api/v1
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir))) # .../backend
    graph_path = os.path.join(backend_root, "data", "repo_graph.json")
    
    # DEBUG PRINT (Check your terminal when you reload the page!)
    print(f"🔍 LOOKING FOR GRAPH AT: {graph_path}")

    if not os.path.exists(graph_path):
        logger.warning(f"Graph file not found at: {graph_path}")
        return {"nodes": [], "links": []}
        
    try:
        with open(graph_path, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        logger.error(f"Graph read error: {e}")
        return {"nodes": [], "links": []}

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