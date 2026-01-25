import os
import logging
import socket
from typing import List, Union, Optional
from pathlib import Path
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator
from dotenv import load_dotenv

# Setup Logging
logger = logging.getLogger("uvicorn")

# --- SMART PATH RESOLUTION ---
# In Docker, environment variables are provided via env_file in docker-compose,
# so .env file loading is optional. Pydantic-settings will read from environment variables.
CONFIG_DIR = Path(__file__).resolve().parent  # app/core
BACKEND_DIR = CONFIG_DIR.parent.parent        # backend
ROOT_DIR = BACKEND_DIR.parent                 # app (root)

env_paths = [
    ROOT_DIR / ".env",           # app/.env (your backend .env)
    BACKEND_DIR / ".env",
    Path(os.getcwd()) / ".env"
]

loaded = False
for path in env_paths:
    if path.exists():
        load_dotenv(path, override=False)  # Don't override existing env vars
        logger.info(f"✅ Loaded .env file from: {path}")
        loaded = True
        break

# Only warn if running locally (not in Docker) and no env vars are set
if not loaded and not os.getenv("POSTGRES_HOST") and os.getenv("ENVIRONMENT") != "production":
    logger.debug(f"ℹ️ No .env file found (checked: {[str(p) for p in env_paths]}). Using environment variables.")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Dex Cognitive Engine"
    VERSION: str = "2.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # --- AI & Vector DB Keys ---
    # PostgreSQL + pgvector configuration
    # Note: In Docker, these are overridden by environment variables in docker-compose.yml
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "dex"
    POSTGRES_VECTOR_TABLE: str = "document_vectors"  # Table name for vector storage
    
    GROQ_API_KEY: str = ""
    GITHUB_TOKEN: str = "" 
    OPENAI_API_KEY: str = ""
    
    @field_validator("POSTGRES_PASSWORD", mode="before")
    def validate_postgres_password(cls, v):
        """Warn if PostgreSQL password is missing in production."""
        if not v and os.getenv("ENVIRONMENT") == "production":
            import warnings
            warnings.warn("POSTGRES_PASSWORD is not set in production environment!")
        return v
    
    @field_validator("GROQ_API_KEY", mode="before")
    def validate_groq_key(cls, v):
        """Warn if GROQ_API_KEY is missing."""
        if not v:
            import warnings
            warnings.warn("GROQ_API_KEY is not set. RAG queries will fail!")
        return v
    
    def _resolve_ipv4_host(self, hostname: str) -> str:
        """Resolve hostname to IPv4 address to avoid IPv6 issues"""
        # If it's already an IP address, return as-is
        try:
            socket.inet_aton(hostname)
            return hostname  # Already an IPv4 address
        except socket.error:
            pass  # Not an IP address, continue with resolution
        
        # Try multiple methods to get IPv4 address
        methods = [
            # Method 1: getaddrinfo with AF_INET (IPv4 only)
            lambda: socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM),
            # Method 2: gethostbyname (legacy, IPv4 only)
            lambda: [(socket.AF_INET, socket.SOCK_STREAM, 0, '', (socket.gethostbyname(hostname), 0))],
        ]
        
        for method in methods:
            try:
                addrinfo = method()
                if addrinfo:
                    ipv4_address = addrinfo[0][4][0]  # Get first IPv4 address
                    logger.info(f"✅ Resolved {hostname} to IPv4: {ipv4_address}")
                    return ipv4_address
            except (socket.gaierror, OSError, socket.herror) as e:
                continue  # Try next method
        
        # If all methods fail, log warning but return hostname
        # The connection pooler should handle IPv4, but if it doesn't work,
        # check network settings or database provider configuration
        logger.warning(f"⚠️ Failed to resolve {hostname} to IPv4. Connection may fail if network doesn't support IPv6.")
        logger.warning(f"⚠️ If connection fails, check database provider network settings.")
        return hostname  # Fallback to hostname - connection pooler should handle this
    
    @property
    def POSTGRES_CONNECTION_STRING(self) -> str:
        """Generate PostgreSQL connection string for pgvector"""
        # URL-encode password to handle special characters like @, [, ], etc.
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        encoded_user = quote_plus(self.POSTGRES_USER)
        # Resolve to IPv4 to avoid IPv6 connection issues
        resolved_host = self._resolve_ipv4_host(self.POSTGRES_HOST)
        connection_string = f"postgresql://{encoded_user}:{encoded_password}@{resolved_host}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        logger.debug(f"PostgreSQL connection string generated for pgvector (host: {resolved_host}, port: {self.POSTGRES_PORT})")
        return connection_string 

    # --- Neo4j Graph DB Config (New) ---
    # We make these Optional so the app doesn't crash if you just want to run unit tests
    # But they are required for the Graph Engine to work.
    NEO4J_URI: Optional[str] = None
    NEO4J_USERNAME: Optional[str] = None
    NEO4J_PASSWORD: Optional[str] = None
    
    # --- Email Service (Resend) ---
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "onboarding@resend.dev"
    RESEND_FROM_NAME: str = "DEX"
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def DATABASE_URL(self) -> str:
        """Generate PostgreSQL connection string for SQLAlchemy (user storage)"""
        # URL-encode password to handle special characters like @, [, ], etc.
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        encoded_user = quote_plus(self.POSTGRES_USER)
        # Resolve to IPv4 to avoid IPv6 connection issues
        resolved_host = self._resolve_ipv4_host(self.POSTGRES_HOST)
        connection_string = f"postgresql://{encoded_user}:{encoded_password}@{resolved_host}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        # Log connection details (without password) for debugging
        logger.info(f"Database connection: {self.POSTGRES_USER}@{resolved_host}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}")
        return connection_string 

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()

# Log configuration after initialization for debugging
logger.info(f"PostgreSQL Config - Host: {settings.POSTGRES_HOST}, Port: {settings.POSTGRES_PORT}, DB: {settings.POSTGRES_DB}, User: {settings.POSTGRES_USER}")

# Warn if using default localhost (likely missing env var)
if settings.POSTGRES_HOST == "localhost" and os.getenv("ENVIRONMENT") == "production":
    logger.warning("⚠️ WARNING: POSTGRES_HOST is 'localhost' in production! This usually means the environment variable is not set.")
    logger.warning("⚠️ Please set POSTGRES_HOST in your deployment platform's environment variables to your database hostname.")