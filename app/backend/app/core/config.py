import os
import logging
from typing import List, Union, Optional
from pathlib import Path
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator
from dotenv import load_dotenv

# Setup Logging
logger = logging.getLogger("uvicorn")

# --- SMART PATH RESOLUTION ---
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
        load_dotenv(path)
        logger.info(f"✅ Loaded .env file from: {path}")
        loaded = True
        break

if not loaded:
    logger.warning(f"⚠️ Could not find .env file! Checked: {[str(p) for p in env_paths]}")

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
    
    @property
    def POSTGRES_CONNECTION_STRING(self) -> str:
        """Generate PostgreSQL connection string for pgvector"""
        # URL-encode password to handle special characters like @, [, ], etc.
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        encoded_user = quote_plus(self.POSTGRES_USER)
        return f"postgresql://{encoded_user}:{encoded_password}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}" 

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
        return f"postgresql://{encoded_user}:{encoded_password}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}" 

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()