import os
import time
import uuid
import logging
import sys
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

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
logging.basicConfig(
    level=logging.INFO,
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
    allow_methods=["*"],  # Allow GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Allow Content-Type, Authorization, etc.
)

# --- Request Interceptor (Performance & Auditing) ---
@app.middleware("http")
async def request_interceptor(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.perf_counter()
    
    logger.info(f"Incoming Request | ID: {request_id} | Method: {request.method} | Path: {request.url.path}")
    
    try:
        response = await call_next(request)
        process_time = time.perf_counter() - start_time
        
        # Inject Proprietary Metrics Headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(round(process_time, 4))
        
        logger.info(f"Request Completed | ID: {request_id} | Status: {response.status_code} | Duration: {process_time:.4f}s")
        return response
        
    except Exception as error:
        logger.error(f"System Failure | ID: {request_id} | Error: {str(error)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Internal System Error", "request_id": request_id}
        )

# --- Router Registration ---
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
async def health_probe():
    return {
        "status": "active",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "cors_allowed": origins
    }

if __name__ == "__main__":
    import uvicorn
    # Reload=True is great for dev, but consider turning off for prod
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)