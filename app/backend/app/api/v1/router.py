import os
import json
import logging
import networkx as nx
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
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

# --- Helpers ---
def _ensure_graph_loaded():
    """
    Ensures the NetworkX graph is loaded in memory for the Impact Radar.
    If the server restarted, we reload it from the JSON file.
    """
    if ingestion_service.graph_engine.graph.number_of_nodes() > 0:
        return # Already loaded

    # Path resolution
    current_dir = os.path.dirname(os.path.abspath(__file__)) 
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
    graph_path = os.path.join(backend_root, "data", "repo_graph.json")

    if not os.path.exists(graph_path):
        return # Nothing to load

    try:
        logger.info("Hydrating Graph Engine from disk...")
        with open(graph_path, 'r') as f:
            data = json.load(f)
        
        # Reconstruct NetworkX graph manually to ensure accuracy
        G = ingestion_service.graph_engine.graph
        for node in data.get("nodes", []):
            G.add_node(node["id"], **node)
        for link in data.get("links", []):
            G.add_edge(link["source"], link["target"], relation=link.get("relation"))
            
        logger.info(f"Graph hydrated: {G.number_of_nodes()} nodes.")
    except Exception as e:
        logger.error(f"Failed to hydrate graph: {e}")

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
    return {"status": "ok", "version": "1.1.0"}

@api_router.get("/graph/structure")
def get_knowledge_graph():
    """
    Returns graph JSON for Frontend Visualization (Force Graph).
    """
    current_dir = os.path.dirname(os.path.abspath(__file__)) 
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir))) 
    graph_path = os.path.join(backend_root, "data", "repo_graph.json")
    
    if not os.path.exists(graph_path):
        return {"nodes": [], "links": []}
        
    try:
        with open(graph_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Graph read error: {e}")
        return {"nodes": [], "links": []}

@api_router.get("/graph/impact")
def get_impact_graph(file_id: str = Query(..., description="The file ID (path) to analyze blast radius for")):
    """
    IMPACT RADAR: Returns the 'Blast Radius' subgraph.
    Shows what files depend on the target file.
    """
    _ensure_graph_loaded()
    
    # Calculate subgraph using Graph Engine
    subgraph_data = ingestion_service.graph_engine.get_impact_subgraph(file_id, depth=2)
    return subgraph_data

@api_router.get("/git/history")
def get_git_history():
    """
    TIME TRAVEL: Returns the commit timeline for the slider.
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