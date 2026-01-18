import os
import logging
from typing import List, Union, Optional
from pathlib import Path
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
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # --- AI & Vector DB Keys ---
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = ""
    GROQ_API_KEY: str = ""
    GITHUB_TOKEN: str = "" 
    OPENAI_API_KEY: str = "" 

    # --- Neo4j Graph DB Config (New) ---
    # We make these Optional so the app doesn't crash if you just want to run unit tests
    # But they are required for the Graph Engine to work.
    NEO4J_URI: Optional[str] = None
    NEO4J_USERNAME: Optional[str] = None
    NEO4J_PASSWORD: Optional[str] = None

    DATABASE_URL: str = "sqlite:///./dex.db" 

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()