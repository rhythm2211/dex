import os
import time
import uuid
import logging
import sys
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException

# Fix HuggingFace tokenizers warning when using multiprocessing (uvicorn --reload)
# Set this before any tokenizer imports
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Adjust path to ensure modules are discoverable
sys.path.append(".")

from backend.app.core.config import settings
from backend.app.api.v1.router import api_router
from backend.app.models.user import init_db

# Initialize database on startup
init_db()

# Proprietary Structured Logging
# Set log level based on environment
log_level = logging.WARNING if settings.ENVIRONMENT == "production" else logging.INFO
logging.basicConfig(
    level=log_level,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "service": "dex-engine", "trace_id": "%(process)d", "message": "%(message)s"}',
    datefmt='%Y-%m-%dT%H:%M:%SZ'
)
logger = logging.getLogger("dex-core")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
)

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
    "https://dex-production-6dd4.up.railway.app",  # Railway backend (for direct access)
]

# Log allowed origins for debugging
logger.info(f"🌐 CORS allowed origins: {origins}")
print(f"[CORS] Allowed origins: {origins}", flush=True)

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
    allow_headers=["*"],  # Allow Content-Type, Authorization, X-User-Email, X-User-Id, etc.
    expose_headers=["*"],  # Expose all headers in response
    max_age=3600,  # Cache preflight requests for 1 hour
)

# --- Request Interceptor (Performance & Auditing) ---
@app.middleware("http")
async def request_interceptor(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.perf_counter()
    
    # Log origin for CORS debugging (only for non-OPTIONS to avoid conflicts)
    origin = request.headers.get("origin", "no-origin")
    if request.method != "OPTIONS":
        logger.info(f"Incoming Request | ID: {request_id} | Method: {request.method} | Path: {request.url.path} | Origin: {origin}")
        # Also print to stdout for immediate visibility
        print(f"[MIDDLEWARE] {request.method} {request.url.path} | Origin: {origin}", flush=True)
    else:
        # Log OPTIONS requests for CORS debugging
        logger.info(f"CORS Preflight | ID: {request_id} | Path: {request.url.path} | Origin: {origin}")
        print(f"[CORS] OPTIONS {request.url.path} | Origin: {origin}", flush=True)
    
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
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
async def health_probe():
    """
    Production-grade health check endpoint.
    Checks database connectivity and service status.
    Fast, non-blocking health check with timeouts.
    """
    import asyncio
    health_status = {
        "status": "active",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
    
    # Check PostgreSQL connection with timeout
    try:
        from sqlalchemy import text
        from backend.app.models.user import engine
        # Use existing engine from user model (don't create new connection)
        with engine.connect() as conn:
            # Quick query with timeout
            result = conn.execute(text("SELECT 1"))
            result.fetchone()  # Consume result
        health_status["postgres"] = "connected"
    except Exception as e:
        logger.error(f"PostgreSQL health check failed: {e}")
        health_status["postgres"] = "disconnected"
        health_status["status"] = "degraded"
    
    # Check Neo4j connection (if configured) with timeout
    if settings.NEO4J_URI:
        try:
            from backend.app.utils.neo4j_driver_manager import neo4j_driver_manager
            # Quick check with timeout
            if neo4j_driver_manager.verify_connection():
                health_status["neo4j"] = "connected"
            else:
                health_status["neo4j"] = "disconnected"
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

if __name__ == "__main__":
    import uvicorn
    # Disable reload in production for better performance and stability
    reload = settings.ENVIRONMENT != "production"
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=reload)