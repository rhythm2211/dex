import os
import json
import logging
from datetime import datetime, timedelta
from collections import Counter
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel

# --- Service Imports ---
from backend.app.services.ingestion_service import IngestionService
from backend.app.services.rag_service import RAGService
from backend.app.api.v1.endpoints.users import router as users_router
from backend.app.api.v1.endpoints.health import router as health_router

logger = logging.getLogger("dex-core")

api_router = APIRouter()

# Include user routes
api_router.include_router(users_router, tags=["users"])

# Include health routes
api_router.include_router(health_router, prefix="/health", tags=["health"])

# --- Singleton Services (Lazy Initialization) ---
# Initialize services lazily to avoid blocking on startup
_ingestion_service = None
_rag_service = None
# Lightweight status storage (doesn't require full service initialization)
_ingestion_status = {"state": "idle", "progress": 0, "step": "Ready"}
# Track if cancellation was requested
_cancellation_requested = False

def get_ingestion_service():
    global _ingestion_service
    if _ingestion_service is None:
        try:
            _ingestion_service = IngestionService()
            # Sync status after initialization
            global _ingestion_status
            _ingestion_status = _ingestion_service.get_current_status()
        except Exception as e:
            logger.exception(f"Failed to initialize IngestionService: {e}", exc_info=True)
            raise RuntimeError(f"Failed to initialize ingestion service: {str(e)}") from e
    return _ingestion_service

def get_ingestion_status_lightweight():
    """Get ingestion status without initializing the full service."""
    global _ingestion_service, _ingestion_status
    if _ingestion_service is not None:
        # Service is initialized, use it
        return _ingestion_service.get_current_status()
    else:
        # Service not initialized, return cached status
        return _ingestion_status

def get_rag_service():
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service

# --- Data Models ---
class IngestRequest(BaseModel):
    repo_path: str

class HybridRAGRequest(BaseModel):
    query: str

# --- Background Task Wrapper ---
def run_ingestion_sequence(repo_path: str):
    global _ingestion_status, _cancellation_requested
    _cancellation_requested = False  # Reset cancellation flag at start
    try:
        ingestion_service = get_ingestion_service()
        # Sync status immediately after initialization
        _ingestion_status = ingestion_service.get_current_status()
        
        logger.info(f"🚀 Starting background ingestion for: {repo_path}")
        result = ingestion_service.process_repository(repo_path)
        
        # Sync status after processing
        _ingestion_status = ingestion_service.get_current_status()
        
        if result.get("status") == "success":
            logger.info("💾 Ingestion processing done. Triggering RAG memory refresh...")
            rag_service = get_rag_service()
            rag_service.reload_knowledge_base()
            logger.info("✅ System fully updated.")
        elif result.get("status") == "cancelled":
            logger.info("🛑 Ingestion was cancelled by user")
        else:
            logger.error(f"❌ Ingestion failed: {result.get('error')}")
    except Exception as e:
        logger.exception(f"Background task crashed: {e}")
        try:
            ingestion_service = get_ingestion_service()
            ingestion_service._update_status("error", 0, f"System Error: {str(e)}")
            _ingestion_status = ingestion_service.get_current_status()
        except:
            # If service initialization fails, update lightweight status
            _ingestion_status = {"state": "error", "progress": 0, "step": f"System Error: {str(e)}"}

# --- Endpoints ---

@api_router.get("/health")
def health_check():
    return {"status": "ok", "version": "1.3.0 (Neo4j Cloud + Onboarding)"}

@api_router.get("/graph/structure")
async def get_knowledge_graph():
    """
    Fetches the knowledge graph directly from Neo4j Cloud.
    Now supports massive datasets via smart limits.
    Made async to prevent blocking and allow timeout handling.
    """
    try:
        # Default limit 2500 to prevent browser crash on initial load
        ingestion_service = get_ingestion_service()
        graph_data = ingestion_service.graph_engine.get_full_graph(limit=2500)
        return graph_data
    except Exception as e:
        logger.error(f"Neo4j Read Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"nodes": [], "links": []}

@api_router.get("/graph/impact")
def get_impact_graph(file_id: str = Query(..., description="The file ID (path) to analyze blast radius for")):
    """
    IMPACT RADAR: Queries Neo4j for the dependency subgraph.
    Returns: All files that depend on 'file_id' (Upstream Dependencies).
    """
    try:
        ingestion_service = get_ingestion_service()
        return ingestion_service.graph_engine.get_impact_subgraph(file_id)
    except Exception as e:
        logger.error(f"Neo4j Impact Query Error: {e}")
        return {"nodes": [], "links": []}

@api_router.get("/graph/expand")
def expand_graph_node(node_id: str = Query(..., description="The node ID to expand and load children for")):
    """
    LAZY LOADING: Fetches immediate children/neighbors of a node.
    Used when a user expands a node in the graph visualization.
    """
    try:
        ingestion_service = get_ingestion_service()
        return ingestion_service.graph_engine.get_neighbors(node_id)
    except Exception as e:
        logger.error(f"Neo4j Expand Query Error: {e}")
        return {"nodes": [], "links": []}

@api_router.get("/git/history")
def get_git_history():
    """
    TIME TRAVEL: Returns the commit timeline for the slider.
    NOTE: History is still kept local (JSON) because it's sequential and small.
    """
    # Reuse consistent path logic
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

# ==========================================
# 🚀 NEW ONBOARDING FEATURES (Team & Heatmap)
# ==========================================

@api_router.get("/onboarding/team-topology")
async def get_team_topology():
    """
    Returns a social graph of the team.
    Nodes = Developers. Edges = Collaboration strength (co-edited files).
    Uses the Neo4j driver from the existing GraphEngine.
    """
    ingestion_service = get_ingestion_service()
    engine = ingestion_service.graph_engine
    
    if not engine or not engine.driver:
        # Fallback if graph isn't ready
        logger.warning("Graph Engine not ready for topology query.")
        return {"nodes": [], "links": []}

    # Cypher: Find pairs of authors who edited the same files
    # We look for nodes where 'collaborators' list has >1 person
    query = """
    MATCH (n:CodeNode)
    WHERE size(n.collaborators) > 1
    UNWIND n.collaborators as author1
    UNWIND n.collaborators as author2
    WITH author1, author2, count(n) as weight
    WHERE author1 < author2  // distinct pairs only to avoid A-A or A-B + B-A
    RETURN author1, author2, weight
    ORDER BY weight DESC
    LIMIT 100
    """
    
    nodes = set()
    links = []
    
    try:
        with engine.driver.session() as session:
            result = session.run(query)
            for record in result:
                a1 = record["author1"]
                a2 = record["author2"]
                w = record["weight"]
                
                nodes.add(a1)
                nodes.add(a2)
                links.append({"source": a1, "target": a2, "value": w})
        
        # Format for D3.js (People Nodes)
        node_list = [{"id": name, "group": "person", "radius": 20} for name in nodes]
        return {"nodes": node_list, "links": links}
        
    except Exception as e:
        logger.error(f"Team Topology Query Error: {e}")
        return {"nodes": [], "links": []}

@api_router.get("/onboarding/active-zones")
async def get_active_zones(days: int = 30):
    """
    Returns a Heatmap of the repo.
    Hot Zones = Folders with high commit activity in the last X days.
    """
    # 1. Resolve Path (Same logic as get_git_history)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
    history_path = os.path.join(backend_root, "data", "repo_history.json")
    
    if not os.path.exists(history_path):
        return {"zones": [], "msg": "No history found. Run ingestion first."}
        
    try:
        with open(history_path, 'r') as f:
            timeline = json.load(f)
            
        # 2. Filter by Date
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        # 3. Aggregate: Folder -> Commit Count
        zone_heat = Counter()
        
        for commit in timeline:
            if commit["date"] < cutoff_date:
                continue
                
            for file_path in commit["files"]:
                # Logic: Get top-level folder (or 'root' if file is at base)
                # Example: "backend/app/main.py" -> "backend/app"
                parts = file_path.split('/')
                if len(parts) > 1:
                    # Use first 2 levels for better grouping in large repos
                    # e.g., "backend/services" vs "frontend/components"
                    zone = parts[0] + "/" + parts[1] if len(parts) > 2 else parts[0]
                else:
                    zone = "root"
                
                zone_heat[zone] += 1
        
        # 4. Format for Frontend
        # Returns top 15 hottest zones
        results = [
            {
                "name": zone, 
                "value": count, 
                "intensity": "High" if count > 10 else "Low"
            }
            for zone, count in zone_heat.most_common(15)
        ]
        
        return {"zones": results}
        
    except Exception as e:
        logger.error(f"Heatmap generation failed: {e}")
        # Return empty list rather than 500 to keep UI stable
        return {"zones": []}

# ==========================================
# 📦 EXISTING INGESTION & QUERY ENDPOINTS
# ==========================================

@api_router.post("/ingest")
async def trigger_ingestion(request: IngestRequest, background_tasks: BackgroundTasks):
    """
    Trigger ingestion in background. Returns immediately.
    Use /ingest/status to check progress.
    """
    try:
        # Check status without initializing the full service (lazy check)
        current_status = get_ingestion_status_lightweight()
        
        if current_status["state"] == "running":
            raise HTTPException(status_code=409, detail="An ingestion task is already running.")

        # Start background task - this should return immediately
        # Service initialization will happen in the background task, not here
        background_tasks.add_task(run_ingestion_sequence, request.repo_path)
        
        logger.info(f"Ingestion request accepted for: {request.repo_path}")
        return {
            "status": "accepted",
            "message": f"Ingestion started for {request.repo_path}. Check /ingest/status for progress."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to start ingestion: {e}", exc_info=True)
        error_detail = str(e)
        # Provide more helpful error messages for common issues
        if "Neo4j" in error_detail or "NEO4J" in error_detail:
            error_detail = f"Neo4j connection error: {error_detail}. Please check NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD environment variables."
        elif "PostgreSQL" in error_detail or "postgres" in error_detail.lower():
            error_detail = f"PostgreSQL connection error: {error_detail}. Please check database connection settings."
        elif "GraphEngine" in error_detail or "graph_engine" in error_detail.lower():
            error_detail = f"Graph engine initialization error: {error_detail}. Please check Neo4j configuration."
        raise HTTPException(status_code=500, detail=f"Failed to start ingestion: {error_detail}")

@api_router.get("/ingest/status")
def get_ingestion_status():
    # Use lightweight status check to avoid blocking on service initialization
    return get_ingestion_status_lightweight()

@api_router.post("/ingest/cancel")
def cancel_ingestion():
    """
    Cancel the currently running ingestion process.
    """
    global _ingestion_status, _cancellation_requested
    _cancellation_requested = True
    try:
        ingestion_service = get_ingestion_service()
        ingestion_service.cancel()
        _ingestion_status = ingestion_service.get_current_status()
        logger.info("🛑 Ingestion cancellation requested via API")
        return {"status": "cancelled", "message": "Ingestion cancellation requested"}
    except Exception as e:
        logger.error(f"Failed to cancel ingestion: {e}")
        # Try to update status anyway
        _ingestion_status = {"state": "cancelled", "progress": 0, "step": "Cancellation attempted"}
        return {"status": "cancelled", "message": f"Cancellation requested (service may not be initialized): {str(e)}"}

@api_router.post("/ingest/reset")
def reset_ingestion_status():
    """
    Reset ingestion status if it gets stuck.
    This allows starting a new ingestion after a failed/stuck one.
    """
    global _ingestion_status
    try:
        # Reset lightweight status immediately
        _ingestion_status = {"state": "idle", "progress": 0, "step": "Ready"}
        
        # If service is initialized, also reset it
        if _ingestion_service is not None:
            _ingestion_service._update_status("idle", 0, "Ready")
            _ingestion_status = _ingestion_service.get_current_status()
        
        logger.info("Ingestion status reset to idle")
        return {"status": "reset", "message": "Ingestion status has been reset"}
    except Exception as e:
        logger.error(f"Failed to reset ingestion status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset ingestion status: {str(e)}")

@api_router.post("/query/hybrid")
def execute_hybrid_query(request: HybridRAGRequest):
    try:
        rag_service = get_rag_service()
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
        ingestion_service = get_ingestion_service()
        return ingestion_service.graph_engine.get_neighbors(node_id)
    except Exception as e:
        logger.error(f"Graph Expansion Error: {e}")
        return {"nodes": [], "links": []}