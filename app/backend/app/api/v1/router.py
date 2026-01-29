import os
import json
import logging
import time
import asyncio
from datetime import datetime, timedelta
from collections import Counter
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, field_validator

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:9", "message": "router.py module started importing", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion

# --- Service Imports (LAZY) ---
# Import services lazily to avoid blocking startup with heavy dependencies like langchain
# Services will be imported only when get_ingestion_service() or get_rag_service() are first called

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:16", "message": "About to import users_router", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from backend.app.api.v1.endpoints.users import router as users_router
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:17", "message": "users_router imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:17", "message": "users_router import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:18", "message": "About to import health_router", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from backend.app.api.v1.endpoints.health import router as health_router
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:19", "message": "health_router imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:19", "message": "health_router import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

logger = logging.getLogger("dex-core")

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:20", "message": "About to create api_router", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
api_router = APIRouter()
# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:21", "message": "api_router created successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion

# Include user routes
# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:24", "message": "About to include users_router", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    api_router.include_router(users_router, tags=["users"])
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:25", "message": "users_router included successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:25", "message": "users_router include failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# Include health routes
# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:28", "message": "About to include health_router", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    api_router.include_router(health_router, prefix="/health", tags=["health"])
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:29", "message": "health_router included successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "router.py:29", "message": "health_router include failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

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
            # Lazy import to avoid blocking startup
            from backend.app.services.ingestion_service import IngestionService
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
        try:
            # Lazy import to avoid blocking startup
            from backend.app.services.rag_service import RAGService
            _rag_service = RAGService()
        except Exception as e:
            logger.exception(f"Failed to initialize RAGService: {e}", exc_info=True)
            raise RuntimeError(f"Failed to initialize RAG service: {str(e)}") from e
    return _rag_service

# --- Data Models ---
class IngestRequest(BaseModel):
    repo_path: str
    
    @field_validator("repo_path")
    @classmethod
    def validate_repo_path(cls, v: str) -> str:
        """Validate repository path for security."""
        if not v or not v.strip():
            raise ValueError("Repository path cannot be empty")
        if len(v) > 2048:
            raise ValueError("Repository path is too long (max 2048 characters)")
        return v.strip()

class HybridRAGRequest(BaseModel):
    query: str
    
    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        """Validate query input for security and length."""
        if not v or not v.strip():
            raise ValueError("Query cannot be empty")
        if len(v) > 10000:  # Reasonable limit for LLM queries
            raise ValueError("Query is too long (max 10000 characters)")
        return v.strip()

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
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        # Default limit 2500 to prevent browser crash on initial load
        ingestion_service = get_ingestion_service()
        
        # Run the synchronous Neo4j query in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            graph_data = await loop.run_in_executor(
                executor,
                lambda: ingestion_service.graph_engine.get_full_graph(limit=2500)
            )
        
        # Validate response structure
        if not isinstance(graph_data, dict):
            logger.warning("Graph data is not a dictionary, returning empty graph")
            return {"nodes": [], "links": []}
        
        if "nodes" not in graph_data or "links" not in graph_data:
            logger.warning("Graph data missing 'nodes' or 'links' keys, returning empty graph")
            return {"nodes": [], "links": []}
        
        logger.info(f"Graph loaded successfully: {len(graph_data.get('nodes', []))} nodes, {len(graph_data.get('links', []))} links")
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

@api_router.get("/blast-radius/{node_id}")
def get_blast_radius(node_id: str):
    """
    [LAYER 2 & 3] IMPROVED RISK SCORING: Dynamic Risk Propagation with Relationship Traversal
    
    Returns React Flow compatible format with:
    - Risk-scored nodes with dynamic coloring based on risk scores
    - Smart CI Checklist (test files to run)
    - Human Routing (expert recommendations)
    
    Args:
        node_id: The source node ID (file path or function identifier)
        
    Returns:
        Dict with 'nodes', 'edges', 'total_risk_score', 'test_files', 'warnings', 'expert_recommendations'
    """
    try:
        ingestion_service = get_ingestion_service()
        blast_radius_data = ingestion_service.graph_engine.get_blast_radius(node_id)
        
        # Ensure React Flow compatibility - nodes need 'id' and edges need 'id', 'source', 'target'
        nodes = []
        for node in blast_radius_data.get("nodes", []):
            # Ensure node has required React Flow properties
            react_flow_node = {
                "id": node.get("id", ""),
                "data": {
                    "label": node.get("name", node.get("id", "")),
                    "type": node.get("type", "file"),
                    "impactType": node.get("impactType", "source"),
                    **{k: v for k, v in node.items() if k not in ["id", "name", "type", "impactType", "color"]}
                },
                "type": "default",  # React Flow node type
                "style": {
                    "background": node.get("color", "#6b7280"),  # Use dynamic color from backend
                    "color": "#fff" if node.get("color") == "#000000" or node.get("color") == "black" else "#000",
                    "border": f"2px solid {node.get('color', '#6b7280')}",
                    "borderRadius": "8px",
                    "padding": "10px",
                    "fontSize": "12px"
                }
            }
            nodes.append(react_flow_node)
        
        edges = blast_radius_data.get("edges", [])
        # Ensure edges have required React Flow properties
        react_flow_edges = []
        for edge in edges:
            react_flow_edge = {
                "id": edge.get("id", f"{edge.get('source')}-{edge.get('target')}"),
                "source": edge.get("source", ""),
                "target": edge.get("target", ""),
                "type": edge.get("type", "smoothstep"),
                "style": edge.get("style", {"stroke": "#999", "strokeWidth": 2}),
                "label": edge.get("label"),  # For dynamic import warnings
                "animated": edge.get("animated", False)  # Use animated from backend
            }
            react_flow_edges.append(react_flow_edge)
        
        # [LAYER 3] Get expert recommendations for human routing
        expert_recommendations = []
        try:
            graph_engine = ingestion_service.graph_engine
            if graph_engine.driver:
                with graph_engine.driver.session(database=graph_engine.database) as session:
                    # Find experts (Person nodes) who are experts on affected files
                    node_ids = [node.get("id") for node in blast_radius_data.get("nodes", [])]
                    if node_ids:
                        expert_query = """
                        MATCH (p:Person)-[r:EXPERT_ON]->(f:CodeNode)
                        WHERE f.id IN $node_ids
                        WITH p, f, r.weight as expertise_weight
                        ORDER BY expertise_weight DESC
                        RETURN DISTINCT p.name as expert_name, 
                               collect(f.id)[0..3] as expert_files,
                               max(expertise_weight) as max_weight
                        LIMIT 5
                        """
                        expert_result = session.run(expert_query, node_ids=node_ids)
                        for rec in expert_result:
                            expert_recommendations.append({
                                "name": rec["expert_name"],
                                "files": rec["expert_files"],
                                "confidence": rec["max_weight"]
                            })
        except Exception as e:
            logger.warning(f"Failed to get expert recommendations: {e}")
        
        return {
            "nodes": nodes,
            "edges": react_flow_edges,
            "total_risk_score": blast_radius_data.get("total_risk_score", 0),
            "test_files": blast_radius_data.get("test_files", []),
            "warnings": blast_radius_data.get("warnings", []),
            "expert_recommendations": expert_recommendations,
            "impact_categories": blast_radius_data.get("impact_categories", {
                "breaking_api_changes": [],
                "data_compliance_risk": [],
                "infrastructure_reset": [],
                "logic_breakage": []
            })
        }
    except Exception as e:
        logger.error(f"Blast radius query error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "nodes": [],
            "edges": [],
            "total_risk_score": 0,
            "test_files": [],
            "warnings": [],
            "expert_recommendations": [],
            "impact_categories": {
                "breaking_api_changes": [],
                "data_compliance_risk": [],
                "infrastructure_reset": [],
                "logic_breakage": []
            }
        }

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
        logger.warning(f"Active zones: History file not found at {history_path}")
        return {"zones": [], "msg": "No history found. Run ingestion first."}
    
    try:
        # Run file I/O in thread pool to avoid blocking the event loop
        def load_and_process():
            with open(history_path, 'r', encoding='utf-8') as f:
                timeline = json.load(f)
            
            # 2. Filter by Date
            cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
            
            # 3. Aggregate: Folder -> Commit Count
            zone_heat = Counter()
            
            for commit in timeline:
                if commit.get("date", "") < cutoff_date:
                    continue
                    
                for file_path in commit.get("files", []):
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
            
            return results
        
        # Run blocking I/O in thread pool
        results = await asyncio.to_thread(load_and_process)
        return {"zones": results}
        
    except Exception as e:
        logger.error(f"Heatmap generation failed: {e}", exc_info=True)
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
        # Input validation and sanitization
        repo_path = request.repo_path.strip()
        if not repo_path:
            raise HTTPException(status_code=400, detail="Repository path cannot be empty")
        
        # Security: Limit URL length to prevent DoS
        if len(repo_path) > 2048:
            raise HTTPException(status_code=400, detail="Repository path is too long (max 2048 characters)")
        
        # Security: Basic URL validation to prevent SSRF-like attacks
        if repo_path.startswith(("http://", "https://", "git@")):
            # Additional validation for URLs
            if ".." in repo_path or "//" in repo_path.replace("://", ""):
                raise HTTPException(status_code=400, detail="Invalid repository path format")
        
        # Check status without initializing the full service (lazy check)
        current_status = get_ingestion_status_lightweight()
        
        if current_status["state"] == "running":
            raise HTTPException(status_code=409, detail="An ingestion task is already running.")

        # Start background task - this should return immediately
        # Service initialization will happen in the background task, not here
        background_tasks.add_task(run_ingestion_sequence, repo_path)
        
        logger.info(f"Ingestion request accepted for: {repo_path}")
        return {
            "status": "accepted",
            "message": f"Ingestion started for {repo_path}. Check /ingest/status for progress."
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

@api_router.post("/blast-radius/analyze-impact")
def analyze_impact_with_rag(request: dict):
    """
    [NEW] RAG-powered Impact Analysis: Answer questions about code changes and their impact.
    
    Example queries:
    - "If I change lines 10-20 in backend/app/main.py, how would other files get impacted?"
    - "What would break if I modify the PaymentService class?"
    - "Which test files should I run if I change the authentication logic?"
    
    Args:
        request: Dict with 'query' (string) and optionally 'node_id' (string) for context
        
    Returns:
        Dict with 'answer' (string) and 'context_used' (string)
    """
    try:
        query_text = request.get("query", "")
        node_id = request.get("node_id", "")
        
        if not query_text:
            raise HTTPException(status_code=400, detail="Query is required")
        
        # Enhance query with blast radius context if node_id provided
        enhanced_query = query_text
        if node_id:
            try:
                ingestion_service = get_ingestion_service()
                blast_data = ingestion_service.graph_engine.get_blast_radius(node_id)
                
                # Add context about affected files
                affected_files = [n.get("name", n.get("id", "")) for n in blast_data.get("nodes", [])[:10]]
                if affected_files:
                    enhanced_query = f"""
Context: Analyzing impact for {node_id}
Affected files: {', '.join(affected_files[:10])}
Risk Score: {blast_data.get('total_risk_score', 0)}/100

User Question: {query_text}
"""
            except Exception as e:
                logger.warning(f"Failed to get blast radius context: {e}")
        
        # Use RAG service to answer the question
        rag_service = get_rag_service()
        response = rag_service.answer_query(enhanced_query)
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Impact analysis query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))