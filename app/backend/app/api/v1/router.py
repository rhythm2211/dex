import os
import json
import logging
from datetime import datetime, timedelta
from collections import Counter
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Depends
from pydantic import BaseModel, field_validator

# --- Service Imports ---
from backend.app.services.ingestion_service import IngestionService
from backend.app.services.rag_service import RAGService
from backend.app.api.v1.endpoints.users import router as users_router
from backend.app.api.v1.endpoints.health import router as health_router
from backend.app.api.v1.dependencies import get_current_user
from backend.app.models.user import User

logger = logging.getLogger("dex-core")

api_router = APIRouter()

# Include user routes
api_router.include_router(users_router, tags=["users"])

# Include health routes
api_router.include_router(health_router, prefix="/health", tags=["health"])

# --- Multi-Tenant Service Management ---
# Store services per user for isolation
# Thread-safe dictionaries with locks for concurrent access
import threading
_services_lock = threading.Lock()
_ingestion_services: dict[str, IngestionService] = {}  # service_key -> IngestionService
_rag_services: dict[str, RAGService] = {}  # service_key -> RAGService
# Track ingestion status per user
_ingestion_statuses: dict[str, dict] = {}  # user_id -> status dict
# Track cancellation requests per user
_cancellation_requests: dict[str, bool] = {}  # user_id -> bool

def get_ingestion_service(user_id: str, repository_id: str = None) -> IngestionService:
    """
    Get or create ingestion service for a specific user.
    Each user gets their own service instance for isolation.
    Thread-safe implementation.
    """
    # Normalize repository_id to avoid key collisions (None vs empty string)
    normalized_repo_id = repository_id or 'default'
    # Create a unique key for user+repository combination
    service_key = f"{user_id}:{normalized_repo_id}"
    
    # Double-check locking pattern for thread safety
    if service_key not in _ingestion_services:
        with _services_lock:
            # Check again after acquiring lock (double-check)
            if service_key not in _ingestion_services:
                try:
                    _ingestion_services[service_key] = IngestionService(user_id=user_id, repository_id=repository_id)
                    # Initialize status for this user (thread-safe)
                    with _services_lock:
                        if user_id not in _ingestion_statuses:
                            _ingestion_statuses[user_id] = {"state": "idle", "progress": 0, "step": "Ready"}
                    logger.info(f"Created IngestionService for user_id={user_id}, repository_id={repository_id}")
                except Exception as e:
                    logger.exception(f"Failed to initialize IngestionService for user {user_id}: {e}", exc_info=True)
                    raise RuntimeError(f"Failed to initialize ingestion service: {str(e)}") from e
    
    return _ingestion_services[service_key]

def get_ingestion_status_lightweight(user_id: str):
    """Get ingestion status for a specific user without initializing the full service. Thread-safe."""
    with _services_lock:
        if user_id in _ingestion_statuses:
            return _ingestion_statuses[user_id].copy()  # Return copy to avoid race conditions
        else:
            # Return default status if user not found
            return {"state": "idle", "progress": 0, "step": "Ready"}

def get_rag_service(user_id: str, repository_id: str = None) -> RAGService:
    """
    Get or create RAG service for a specific user.
    Each user gets their own service instance for isolation.
    Thread-safe implementation.
    """
    # Normalize repository_id to avoid key collisions
    normalized_repo_id = repository_id or 'default'
    # Create a unique key for user+repository combination
    service_key = f"{user_id}:{normalized_repo_id}"
    
    # Double-check locking pattern for thread safety
    if service_key not in _rag_services:
        with _services_lock:
            # Check again after acquiring lock (double-check)
            if service_key not in _rag_services:
                try:
                    _rag_services[service_key] = RAGService(user_id=user_id, repository_id=repository_id)
                    logger.info(f"Created RAGService for user_id={user_id}, repository_id={repository_id}")
                except Exception as e:
                    logger.exception(f"Failed to initialize RAGService for user {user_id}: {e}", exc_info=True)
                    raise RuntimeError(f"Failed to initialize RAG service: {str(e)}") from e
    
    return _rag_services[service_key]

# --- Data Models ---
from pydantic import field_validator

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
def run_ingestion_sequence(repo_path: str, user_id: str, repository_id: str = None):
    """
    Run ingestion sequence for a specific user.
    Now supports multi-tenant isolation with user_id and repository_id.
    """
    logger.info(f"📋 Background task started for user_id={user_id}, repo_path={repo_path}")
    
    # Generate repository_id from repo_path if not provided
    if not repository_id:
        # Use repo URL as repository_id (sanitized)
        import re
        repository_id = re.sub(r'[^a-zA-Z0-9_-]', '_', repo_path)[:100]
    
    # Set initial status immediately (before any service initialization)
    with _services_lock:
        _cancellation_requests[user_id] = False
        _ingestion_statuses[user_id] = {"state": "running", "progress": 0, "step": "Initializing services..."}
    
    logger.info(f"✅ Status initialized for user_id={user_id}, repository_id={repository_id}")
    
    try:
        logger.info(f"🔧 Getting ingestion service for user_id={user_id}, repository_id={repository_id}")
        ingestion_service = get_ingestion_service(user_id, repository_id)
        logger.info(f"✅ Ingestion service obtained for user_id={user_id}")
        
        # Sync status immediately after initialization (thread-safe)
        with _services_lock:
            _ingestion_statuses[user_id] = ingestion_service.get_current_status()
        
        logger.info(f"🚀 Starting background ingestion for user_id={user_id}, repository_id={repository_id}, repo_path={repo_path}")
        result = ingestion_service.process_repository(repo_path, user_id=user_id, repository_id=repository_id)
        
        # Sync status after processing (thread-safe)
        with _services_lock:
            _ingestion_statuses[user_id] = ingestion_service.get_current_status()
        
        if result.get("status") == "success":
            logger.info("💾 Ingestion processing done. Triggering RAG memory refresh...")
            rag_service = get_rag_service(user_id, repository_id)
            rag_service.reload_knowledge_base()
            logger.info("✅ System fully updated.")
        elif result.get("status") == "cancelled":
            logger.info("🛑 Ingestion was cancelled by user")
        else:
            logger.error(f"❌ Ingestion failed: {result.get('error')}")
    except Exception as e:
        logger.exception(f"❌ Background task crashed for user {user_id}: {e}", exc_info=True)
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        try:
            logger.info(f"🔄 Attempting to update error status via service for user_id={user_id}")
            ingestion_service = get_ingestion_service(user_id, repository_id)
            ingestion_service._update_status("error", 0, f"System Error: {str(e)}")
            with _services_lock:
                _ingestion_statuses[user_id] = ingestion_service.get_current_status()
            logger.info(f"✅ Error status updated via service for user_id={user_id}")
        except Exception as service_error:
            logger.error(f"⚠️ Failed to update status via service: {service_error}")
            # If service initialization fails, update lightweight status (thread-safe)
            with _services_lock:
                _ingestion_statuses[user_id] = {"state": "error", "progress": 0, "step": f"System Error: {str(e)}"}
            logger.info(f"✅ Error status updated via lightweight method for user_id={user_id}")

# --- Endpoints ---

@api_router.get("/health")
def health_check():
    return {"status": "ok", "version": "1.3.0 (Neo4j Cloud + Onboarding)"}

@api_router.get("/graph/structure")
async def get_knowledge_graph(
    repository_id: str = Query(None, description="Repository ID to filter graph"),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches the knowledge graph directly from Neo4j Cloud.
    Now supports massive datasets via smart limits and user/repository filtering.
    Made async to prevent blocking and allow timeout handling.
    """
    try:
        # Default limit 2500 to prevent browser crash on initial load
        ingestion_service = get_ingestion_service(current_user.id, repository_id)
        graph_data = ingestion_service.graph_engine.get_full_graph(
            limit=2500, 
            user_id=current_user.id, 
            repository_id=repository_id
        )
        return graph_data
    except Exception as e:
        logger.error(f"Neo4j Read Error for user {current_user.id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"nodes": [], "links": []}

@api_router.get("/graph/impact")
def get_impact_graph(
    file_id: str = Query(..., description="The file ID (path) to analyze blast radius for"),
    repository_id: str = Query(None, description="Repository ID to filter graph"),
    current_user: User = Depends(get_current_user)
):
    """
    IMPACT RADAR: Queries Neo4j for the dependency subgraph.
    Returns: All files that depend on 'file_id' (Upstream Dependencies).
    Now filters by user_id and repository_id for multi-tenant isolation.
    """
    try:
        ingestion_service = get_ingestion_service(current_user.id, repository_id)
        return ingestion_service.graph_engine.get_impact_subgraph(
            file_id, 
            user_id=current_user.id, 
            repository_id=repository_id
        )
    except Exception as e:
        logger.error(f"Neo4j Impact Query Error for user {current_user.id}: {e}")
        return {"nodes": [], "links": []}

@api_router.get("/graph/expand")
def expand_graph_node(
    node_id: str = Query(..., description="The node ID to expand and load children for"),
    repository_id: str = Query(None, description="Repository ID to filter graph"),
    current_user: User = Depends(get_current_user)
):
    """
    LAZY LOADING: Fetches immediate children/neighbors of a node.
    Used when a user expands a node in the graph visualization.
    Now filters by user_id and repository_id for multi-tenant isolation.
    """
    try:
        ingestion_service = get_ingestion_service(current_user.id, repository_id)
        return ingestion_service.graph_engine.get_neighbors(
            node_id, 
            user_id=current_user.id, 
            repository_id=repository_id
        )
    except Exception as e:
        logger.error(f"Neo4j Expand Query Error for user {current_user.id}: {e}")
        return {"nodes": [], "links": []}

@api_router.get("/git/history")
def get_git_history(
    repository_id: str = Query(None, description="Repository ID to get history for"),
    current_user: User = Depends(get_current_user)
):
    """
    TIME TRAVEL: Returns the commit timeline for the slider.
    Now supports multi-tenant isolation - returns history for user's repository.
    NOTE: History is kept in user-specific directories.
    """
    try:
        # Get user-specific history path
        ingestion_service = get_ingestion_service(current_user.id, repository_id)
        history_path = ingestion_service.history_path

        if not os.path.exists(history_path):
            return []

        try:
            with open(history_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"History read error for user {current_user.id}: {e}")
            return []
    except Exception as e:
        logger.error(f"Failed to get git history for user {current_user.id}: {e}")
        return []

# ==========================================
# 🚀 NEW ONBOARDING FEATURES (Team & Heatmap)
# ==========================================

@api_router.get("/onboarding/team-topology")
async def get_team_topology(
    repository_id: str = Query(None, description="Repository ID to get topology for"),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a social graph of the team.
    Nodes = Developers. Edges = Collaboration strength (co-edited files).
    Now filters by user_id and repository_id for multi-tenant isolation.
    """
    try:
        ingestion_service = get_ingestion_service(current_user.id, repository_id)
        engine = ingestion_service.graph_engine
        
        if not engine or not engine.driver:
            logger.warning(f"Graph Engine not ready for topology query for user {current_user.id}.")
            return {"nodes": [], "links": []}

        # Cypher: Find pairs of authors who edited the same files
        # Filter by user_id and repository_id for multi-tenant isolation
        if current_user.id and repository_id:
            query = """
            MATCH (n:CodeNode)
            WHERE n.user_id = $user_id AND n.repository_id = $repository_id
              AND size(n.collaborators) > 1
            UNWIND n.collaborators as author1
            UNWIND n.collaborators as author2
            WITH author1, author2, count(n) as weight
            WHERE author1 < author2
            RETURN author1, author2, weight
            ORDER BY weight DESC
            LIMIT 100
            """
            params = {"user_id": current_user.id, "repository_id": repository_id}
        else:
            # Fallback for backward compatibility (shouldn't happen with auth)
            query = """
            MATCH (n:CodeNode)
            WHERE size(n.collaborators) > 1
            UNWIND n.collaborators as author1
            UNWIND n.collaborators as author2
            WITH author1, author2, count(n) as weight
            WHERE author1 < author2
            RETURN author1, author2, weight
            ORDER BY weight DESC
            LIMIT 100
            """
            params = {}
        
        nodes = set()
        links = []
        
        try:
            with engine.driver.session(database=engine.database) as session:
                result = session.run(query, **params)
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
            logger.error(f"Team Topology Query Error for user {current_user.id}: {e}")
            return {"nodes": [], "links": []}
    except Exception as e:
        logger.error(f"Failed to get team topology for user {current_user.id}: {e}")
        return {"nodes": [], "links": []}

@api_router.get("/onboarding/active-zones")
async def get_active_zones(
    days: int = Query(30, description="Number of days to look back"),
    repository_id: str = Query(None, description="Repository ID to get zones for"),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a Heatmap of the repo.
    Hot Zones = Folders with high commit activity in the last X days.
    Now supports multi-tenant isolation - returns zones for user's repository.
    """
    try:
        # Get user-specific history path
        ingestion_service = get_ingestion_service(current_user.id, repository_id)
        history_path = ingestion_service.history_path
        
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
            
            return {"zones": results}
            
        except Exception as e:
            logger.error(f"Heatmap generation failed for user {current_user.id}: {e}")
            # Return empty list rather than 500 to keep UI stable
            return {"zones": []}
    except Exception as e:
        logger.error(f"Failed to get active zones for user {current_user.id}: {e}")
        return {"zones": []}

# ==========================================
# 📦 EXISTING INGESTION & QUERY ENDPOINTS
# ==========================================

@api_router.post("/ingest")
async def trigger_ingestion(
    request: IngestRequest, 
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Trigger ingestion in background. Returns immediately.
    Use /ingest/status to check progress.
    Now supports multi-tenant isolation - each user can ingest independently.
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
        
        # Generate repository_id from repo_path
        import re
        repository_id = re.sub(r'[^a-zA-Z0-9_-]', '_', repo_path)[:100]
        
        # Check status for this specific user (not global)
        current_status = get_ingestion_status_lightweight(current_user.id)
        
        if current_status["state"] == "running":
            raise HTTPException(
                status_code=409, 
                detail=f"An ingestion task is already running for your account. Please wait for it to complete or cancel it first."
            )

        # Start background task - this should return immediately
        # Service initialization will happen in the background task, not here
        background_tasks.add_task(run_ingestion_sequence, repo_path, current_user.id, repository_id)
        
        logger.info(f"Ingestion request accepted for user_id={current_user.id}, repository_id={repository_id}, repo_path={repo_path}")
        return {
            "status": "accepted",
            "message": f"Ingestion started for {repo_path}. Check /ingest/status for progress.",
            "repository_id": repository_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to start ingestion for user {current_user.id}: {e}", exc_info=True)
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
def get_ingestion_status(
    repository_id: str = Query(None, description="Repository ID to check status for"),
    current_user: User = Depends(get_current_user)
):
    """
    Get ingestion status for the current user.
    Use lightweight status check to avoid blocking on service initialization.
    """
    return get_ingestion_status_lightweight(current_user.id)

@api_router.post("/ingest/cancel")
def cancel_ingestion(
    repository_id: str = Query(None, description="Repository ID to cancel ingestion for"),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel the currently running ingestion process for the current user.
    Thread-safe implementation.
    """
    # Set cancellation flag (thread-safe)
    with _services_lock:
        _cancellation_requests[current_user.id] = True
    
    try:
        ingestion_service = get_ingestion_service(current_user.id, repository_id)
        ingestion_service.cancel()
        with _services_lock:
            _ingestion_statuses[current_user.id] = ingestion_service.get_current_status()
        logger.info(f"🛑 Ingestion cancellation requested via API for user_id={current_user.id}")
        return {"status": "cancelled", "message": "Ingestion cancellation requested"}
    except Exception as e:
        logger.error(f"Failed to cancel ingestion for user {current_user.id}: {e}")
        # Try to update status anyway (thread-safe)
        with _services_lock:
            _ingestion_statuses[current_user.id] = {"state": "cancelled", "progress": 0, "step": "Cancellation attempted"}
        return {"status": "cancelled", "message": f"Cancellation requested (service may not be initialized): {str(e)}"}

@api_router.post("/ingest/reset")
def reset_ingestion_status(
    repository_id: str = Query(None, description="Repository ID to reset status for"),
    current_user: User = Depends(get_current_user)
):
    """
    Reset ingestion status if it gets stuck.
    This allows starting a new ingestion after a failed/stuck one.
    Thread-safe implementation.
    """
    try:
        # Normalize repository_id
        normalized_repo_id = repository_id or 'default'
        service_key = f"{current_user.id}:{normalized_repo_id}"
        
        # Reset lightweight status immediately (thread-safe)
        with _services_lock:
            _ingestion_statuses[current_user.id] = {"state": "idle", "progress": 0, "step": "Ready"}
            _cancellation_requests[current_user.id] = False
            
            # If service is initialized, also reset it
            if service_key in _ingestion_services:
                _ingestion_services[service_key]._update_status("idle", 0, "Ready")
                _ingestion_statuses[current_user.id] = _ingestion_services[service_key].get_current_status()
        
        logger.info(f"Ingestion status reset to idle for user_id={current_user.id}")
        return {"status": "reset", "message": "Ingestion status has been reset"}
    except Exception as e:
        logger.error(f"Failed to reset ingestion status for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset ingestion status: {str(e)}")

@api_router.post("/query/hybrid")
def execute_hybrid_query(
    request: HybridRAGRequest,
    repository_id: str = Query(None, description="Repository ID to query"),
    current_user: User = Depends(get_current_user)
):
    """
    Execute hybrid RAG query.
    Now filters by user_id and repository_id for multi-tenant isolation.
    """
    try:
        rag_service = get_rag_service(current_user.id, repository_id)
        response = rag_service.answer_query(request.query, user_id=current_user.id, repository_id=repository_id)
        return response
    except Exception as e:
        logger.error(f"Query failed for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Removed duplicate /graph/expand endpoint - using the one at line 210 with proper auth