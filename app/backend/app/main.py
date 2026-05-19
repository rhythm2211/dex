import os
import time
import uuid
import logging
import sys
import multiprocessing

# #region agent log - Very early logging to catch import-time issues
try:
    log_path = r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log"
    with open(log_path, "a", encoding="utf-8") as f:
        import json
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "EARLY", "location": "main.py:7", "message": "Module main.py imported", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except Exception as e:
    # If we can't log, at least try to print (though this might not show in uvicorn output)
    pass
# #endregion

# CRITICAL: Fix Windows multiprocessing permission errors
# Set these environment variables BEFORE any imports that might use multiprocessing
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["OMP_NUM_THREADS"] = "1"  # Disable OpenMP threading
os.environ["MKL_NUM_THREADS"] = "1"  # Disable MKL threading
os.environ["NUMEXPR_NUM_THREADS"] = "1"  # Disable NumExpr threading

# Set multiprocessing start method to 'spawn' on Windows (explicit, even though it's default)
# This prevents issues with named pipe creation
if sys.platform == "win32":
    try:
        multiprocessing.set_start_method("spawn", force=True)
    except RuntimeError:
        # Already set, ignore
        pass

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException

# Adjust path to ensure modules are discoverable
sys.path.append(".")

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        import json
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "A", "location": "main.py:33", "message": "About to import config settings", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from backend.app.core.config import settings
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "A", "location": "main.py:34", "message": "Config settings imported successfully", "data": {"env": getattr(settings, "ENVIRONMENT", "unknown")}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "A", "location": "main.py:34", "message": "Config import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        import json
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "main.py:35", "message": "About to import api_router", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from backend.app.utils.rate_limiter import general_limiter
    from backend.app.api.v1.router import api_router
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "main.py:36", "message": "api_router imported successfully - router.py module completed", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            import traceback
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "main.py:36", "message": "api_router import failed", "data": {"error": str(e), "errorType": type(e).__name__, "traceback": traceback.format_exc()}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        import json
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "C", "location": "main.py:37", "message": "About to import init_db", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from backend.app.models.user import init_db
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "C", "location": "main.py:38", "message": "init_db imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "C", "location": "main.py:38", "message": "init_db import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# Proprietary Structured Logging
# Set log level based on environment
log_level = logging.WARNING if settings.ENVIRONMENT == "production" else logging.INFO
logging.basicConfig(
    level=log_level,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "service": "dex-engine", "trace_id": "%(process)d", "message": "%(message)s"}',
    datefmt='%Y-%m-%dT%H:%M:%SZ'
)
logger = logging.getLogger("dex-core")

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        import json
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "D", "location": "main.py:47", "message": "About to create FastAPI app", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
    )
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "D", "location": "main.py:52", "message": "FastAPI app created successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "D", "location": "main.py:52", "message": "FastAPI app creation failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# --- 🔧 CRITICAL FIX: CORS Configuration ---
# We explicitly allow the Next.js frontend origins to prevent Network Errors.
origins = [
    "http://localhost:3000",      # Next.js Local
    "http://localhost:3001",      # Next.js Docker (host port)
    "http://127.0.0.1:3000",      # Next.js Local IP
    "http://127.0.0.1:3001",      # Next.js Docker IP
    "http://localhost:8000",      # Self (Swagger UI)
    "http://localhost:8001",      # Self (Swagger UI - Docker port)
    "http://frontend:3000",       # Docker service name
    "https://dex.net.in",         # Production frontend
    "https://www.dex.net.in",     # Production frontend (www)
]

# If settings provide more origins, add them
if settings.BACKEND_CORS_ORIGINS:
    # Handle both string (comma-separated) and list formats
    if isinstance(settings.BACKEND_CORS_ORIGINS, str):
        origins.extend([origin.strip() for origin in settings.BACKEND_CORS_ORIGINS.split(",")])
    else:
        origins.extend([str(origin) for origin in settings.BACKEND_CORS_ORIGINS])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # Explicitly include OPTIONS
    allow_headers=["*"],  # Allow Content-Type, Authorization, etc.
    expose_headers=["*"],  # Expose all headers in response
)

# --- Request Interceptor (Performance & Auditing) ---
@app.middleware("http")
async def request_interceptor(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.perf_counter()

    _rate_exempt = {
        "/health",
        "/robots.txt",
        f"{settings.API_V1_STR.rstrip('/')}/integrations/webhooks/github",
    }
    if (
        request.method != "OPTIONS"
        and request.url.path not in _rate_exempt
        and not general_limiter.allow(request.client.host if request.client else "unknown")
    ):
        return JSONResponse(
            status_code=429,
            content={"error": "Too many requests. Please slow down.", "retry_after": 60},
            headers={"Retry-After": "60"},
        )
    
    # Log origin for CORS debugging (only for non-OPTIONS to avoid conflicts)
    if request.method != "OPTIONS":
        origin = request.headers.get("origin", "no-origin")
        logger.info(f"Incoming Request | ID: {request_id} | Method: {request.method} | Path: {request.url.path} | Origin: {origin}")
    
    try:
        response = await call_next(request)
        process_time = time.perf_counter() - start_time
        
        # Inject Proprietary Metrics Headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(round(process_time, 4))
        
        logger.info(f"Request Completed | ID: {request_id} | Status: {response.status_code} | Duration: {process_time:.4f}s")
        return response
        
    except Exception as error:
        logger.error(f"System Failure | ID: {request_id} | Error: {str(error)}", exc_info=True)
        # Provide more helpful error messages for common issues
        error_str = str(error)
        error_type = type(error).__name__
        
        # For initialization errors, provide more context
        if "Failed to initialize" in error_str or "RuntimeError" in error_type:
            # Check for common initialization failures
            if "ingestion service" in error_str.lower():
                error_message = "Service initialization failed: Ingestion service unavailable. Check GROQ_API_KEY and NEO4J configuration."
            elif "rag service" in error_str.lower():
                error_message = "Service initialization failed: RAG service unavailable. Check database and API keys."
            elif "database" in error_str.lower() or "connection" in error_str.lower():
                error_message = "Database connection failed. Check database configuration and network connectivity."
            else:
                error_message = f"Service initialization error: {error_str[:200]}" if settings.ENVIRONMENT != "production" else "Service initialization failed. Check logs for details."
        elif settings.ENVIRONMENT == "production":
            # In production, provide generic message but include error type
            error_message = f"Internal System Error ({error_type})"
        else:
            # In development, show full error
            error_message = error_str
        
        # If this is a DB connectivity issue, surface it as "service unavailable"
        # so clients can retry (instead of treating it like auth failure).
        db_markers = [
            "psycopg2.OperationalError",
            "timeout expired",
            "Network is unreachable",
            "connection to server at",
            "Connection refused",
        ]
        is_db_unavailable = any(marker.lower() in error_str.lower() for marker in db_markers)
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE if is_db_unavailable else status.HTTP_500_INTERNAL_SERVER_ERROR

        return JSONResponse(
            status_code=status_code,
            content={"error": error_message, "request_id": request_id, "error_type": error_type}
        )

# --- Global Exception Handlers ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with proper formatting."""
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "Validation Error", "details": exc.errors()}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions consistently."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
    )

# --- Router Registration ---
# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        import json
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "D", "location": "main.py:155", "message": "About to register router", "data": {"prefix": settings.API_V1_STR}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    app.include_router(api_router, prefix=settings.API_V1_STR)
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "D", "location": "main.py:156", "message": "Router registered successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "D", "location": "main.py:156", "message": "Router registration failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# --- Startup Event Handler ---
@app.on_event("startup")
def startup_event():
    """Initialize database on startup (non-blocking)"""
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "E", "location": "main.py:159", "message": "Startup event triggered", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    logger.info("🚀 Starting backend services...")
    
    # Initialize Groq API key manager with round-robin support
    try:
        from backend.app.utils.groq_key_manager import initialize_groq_manager
        api_keys = settings.get_groq_api_keys()
        if api_keys:
            initialize_groq_manager(
                api_keys=api_keys,
                model_name="llama-3.3-70b-versatile",
                temperature=0
            )
            logger.info(f"✅ GroqKeyManager initialized with {len(api_keys)} API key(s)")
        else:
            logger.warning("⚠️ No Groq API keys found. Set GROQ_API_KEYS (comma-separated) or GROQ_API_KEY")
    except Exception as e:
        logger.error(f"❌ Failed to initialize GroqKeyManager: {e}")
        # Don't fail startup, but RAG queries will fail
    # Run init_db in background thread to avoid blocking
    import threading
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "E", "location": "main.py:165", "message": "About to start init_db thread", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    try:
        thread = threading.Thread(target=init_db_wrapper, daemon=True)
        thread.start()
        # #region agent log
        try:
            with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                import json
                f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "E", "location": "main.py:166", "message": "init_db thread started", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
        except: pass
        # #endregion
        logger.info("✅ Backend startup initiated (database init in background)")
    except Exception as e:
        # #region agent log
        try:
            with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                import json
                f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "E", "location": "main.py:166", "message": "Failed to start init_db thread", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
        except: pass
        # #endregion
        logger.error(f"Failed to start init_db thread: {e}", exc_info=True)
        raise

def init_db_wrapper():
    """Wrapper to log init_db execution"""
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "main.py:init_db_wrapper", "message": "init_db_wrapper started", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    try:
        init_db()
        # #region agent log
        try:
            with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                import json
                f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "main.py:init_db_wrapper", "message": "init_db completed successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
        except: pass
        # #endregion
    except Exception as e:
        # #region agent log
        try:
            with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                import json
                f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "main.py:init_db_wrapper", "message": "init_db failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
        except: pass
        # #endregion
        logger.error(f"init_db failed: {e}", exc_info=True)

@app.get("/health", tags=["System"])
async def health_probe():
    """
    Health check for load balancers and orchestrators.
    Checks database connectivity and service status.
    """
    health_status = {
        "status": "active",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
    
    # Check PostgreSQL connection
    try:
        from sqlalchemy import text, create_engine
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        health_status["postgres"] = "connected"
    except Exception as e:
        logger.error(f"PostgreSQL health check failed: {e}")
        health_status["postgres"] = "disconnected"
        health_status["status"] = "degraded"
    
    # Check Neo4j connection (if configured) - Non-blocking with timeout
    if settings.NEO4J_URI:
        try:
            import threading
            from backend.app.utils.connection_utils import (
                create_neo4j_driver,
                verify_neo4j_connection,
                resolve_neo4j_database,
            )

            neo4j_db = resolve_neo4j_database(settings.NEO4J_URI, settings.NEO4J_DATABASE)
            connection_result = {"status": "checking", "error": None}
            
            def check_neo4j():
                try:
                    driver = create_neo4j_driver(
                        settings.NEO4J_URI,
                        settings.NEO4J_USERNAME,
                        settings.NEO4J_PASSWORD,
                        database=neo4j_db,
                        connection_timeout=5  # Short timeout for health check
                    )
                    if driver and verify_neo4j_connection(driver, database=neo4j_db):
                        connection_result["status"] = "connected"
                    else:
                        connection_result["status"] = "disconnected"
                    if driver:
                        driver.close()
                except Exception as e:
                    connection_result["status"] = "disconnected"
                    connection_result["error"] = str(e)[:100]
            
            # Run check in thread with timeout
            thread = threading.Thread(target=check_neo4j, daemon=True)
            thread.start()
            thread.join(timeout=3)  # 3 second timeout for health check
            
            if thread.is_alive():
                # Still checking - mark as unknown/timeout
                health_status["neo4j"] = "checking"
                health_status["status"] = "degraded"
            else:
                health_status["neo4j"] = connection_result["status"]
                if connection_result["error"]:
                    health_status["neo4j_error"] = connection_result["error"]
                if connection_result["status"] != "connected":
                    health_status["status"] = "degraded"
        except Exception as e:
            logger.error(f"Neo4j health check failed: {e}")
            health_status["neo4j"] = "disconnected"
            health_status["status"] = "degraded"
    else:
        health_status["neo4j"] = "not_configured"
    
    # Return appropriate status code
    status_code = 200 if health_status["status"] == "active" else 503
    return JSONResponse(content=health_status, status_code=status_code)


@app.get("/robots.txt", include_in_schema=False)
def robots_txt():
    # Stop 404s for simple crawlers / load balancers that check robots.
    # Adjust rules if you want crawlers to access the UI.
    return PlainTextResponse("User-agent: *\nDisallow: /\n", media_type="text/plain")

if __name__ == "__main__":
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "G", "location": "main.py:__main__", "message": "About to start uvicorn", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    import uvicorn
    # Disable reload in production for better performance and stability
    reload = settings.ENVIRONMENT != "production"
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            import json
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "G", "location": "main.py:__main__", "message": "Calling uvicorn.run", "data": {"reload": reload, "host": "0.0.0.0", "port": 8000}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    try:
        uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=reload)
    except Exception as e:
        # #region agent log
        try:
            with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                import json
                f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "G", "location": "main.py:__main__", "message": "uvicorn.run failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
        except: pass
        # #endregion
        raise