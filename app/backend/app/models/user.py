"""
User database models and schema
"""
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from backend.app.core.config import settings

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)  # NextAuth user ID (email or provider ID)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    company = Column(String, nullable=True)
    role = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    github_username = Column(String, nullable=True, index=True)  # GitHub username for fetching contributions
    profile_completed = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, index=True)  # User account active status
    last_login = Column(DateTime, nullable=True, index=True)  # Last login timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to credentials table
    credentials = relationship("UserCredentials", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "age": self.age,
            "company": self.company,
            "role": self.role,
            "bio": self.bio,
            "github_username": self.github_username,
            "profile_completed": self.profile_completed,
            "is_active": self.is_active,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserCredentials(Base):
    """Separate table for storing user credentials (password hashes)"""
    __tablename__ = "user_credentials"
    
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    password_hash = Column(String, nullable=False)  # Hashed password for credentials auth
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship back to user
    user = relationship("User", back_populates="credentials")

# Database setup - PostgreSQL only
# Add connect_args to prefer IPv4 and handle connection issues
# Note: If using connection pooler (port 6543), it should handle IPv4 automatically
# Optimized connection pool for Railway Hobby Plan + Free Tier Databases
# Railway Hobby: 48GB RAM / 48 vCPU (NOT a bottleneck)
# Neon PostgreSQL Free: 100 connections max
# With connection pooling: ~1-2 connections per active session
# Default: 15 base + 25 overflow = 40 total (safe for 20 sessions, leaves 60 headroom)
# For 25 sessions: Use 20 base + 30 overflow = 50 total
import os
POOL_SIZE = int(os.getenv("POSTGRES_POOL_SIZE", "15"))  # Base pool size (conservative for free tier)
MAX_OVERFLOW = int(os.getenv("POSTGRES_MAX_OVERFLOW", "25"))  # Overflow connections (total: 40)
POOL_RECYCLE = int(os.getenv("POSTGRES_POOL_RECYCLE", "3600"))  # Recycle connections after 1 hour

engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping=True,  # Verify connections before using
    pool_size=POOL_SIZE,  # Base connection pool size
    max_overflow=MAX_OVERFLOW,  # Additional connections when pool is exhausted
    pool_recycle=POOL_RECYCLE,  # Recycle connections to prevent stale connections
    pool_reset_on_return='commit',  # Reset connections on return
    echo=False,  # Set to True for SQL debugging
    connect_args={
        "connect_timeout": 10,  # 10 second timeout
        # Note: statement_timeout removed - not supported by Neon DB connection pooler
        # If needed, set it after connection is established using SQLAlchemy events
        "sslmode": "require",  # Require SSL for secure connections (especially for Neon DB)
        # For Neon DB, hostname is kept for SNI support
        # If hostname is used, psycopg2 will do its own resolution
        "application_name": "dex_backend",  # Identify connections in PostgreSQL
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables and run migrations"""
    from sqlalchemy import text
    import logging
    import time
    import json
    logger = logging.getLogger("dex-core")
    
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "user.py:init_db", "message": "init_db function entry", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    
    # Retry logic for database connection (handles network issues)
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        # #region agent log
        try:
            with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "user.py:init_db", "message": "Database connection attempt", "data": {"attempt": attempt + 1, "maxRetries": max_retries}, "timestamp": int(time.time() * 1000)}) + "\n")
        except: pass
        # #endregion
        try:
            # Test connection first
            # #region agent log
            try:
                with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "user.py:init_db", "message": "About to test database connection", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
            except: pass
            # #endregion
            with engine.connect() as test_conn:
                test_conn.execute(text("SELECT 1"))
            # #region agent log
            try:
                with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "user.py:init_db", "message": "Database connection test successful", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
            except: pass
            # #endregion
            
            # Connection successful, proceed with initialization
            # Register engineering-intelligence models on same Base before create_all
            try:
                import backend.app.models.engineering_models  # noqa: F401
            except Exception as em:
                logger.warning(f"engineering_models import skipped: {em}")
            Base.metadata.create_all(bind=engine)
            
            # Run migration to add is_active and last_login columns if they don't exist
            # This is safe to run multiple times (PostgreSQL only)
            with engine.connect() as conn:
                try:
                    conn.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
                    """))
                    conn.commit()
                except Exception:
                    pass  # Column may already exist
                
                try:
                    conn.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
                    """))
                    conn.commit()
                except Exception:
                    pass  # Column may already exist
                
                # Create user_credentials table if it doesn't exist
                try:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS user_credentials (
                            user_id VARCHAR PRIMARY KEY,
                            password_hash VARCHAR NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT fk_user_credentials_user 
                                FOREIGN KEY (user_id) 
                                REFERENCES users(id) 
                                ON DELETE CASCADE
                        )
                    """))
                    conn.commit()
                    logger.info("✅ user_credentials table created")
                except Exception as e:
                    logger.warning(f"⚠️ user_credentials table creation skipped: {e}")
                
                # Migrate existing password_hash from users table to user_credentials table
                # Only run if users.password_hash exists to avoid transaction aborts
                try:
                    has_password_hash = conn.execute(text("""
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'users'
                          AND column_name = 'password_hash'
                        LIMIT 1
                    """)).first() is not None
                    if has_password_hash:
                        conn.execute(text("""
                            INSERT INTO user_credentials (user_id, password_hash, created_at, updated_at)
                            SELECT id, password_hash, created_at, updated_at
                            FROM users
                            WHERE password_hash IS NOT NULL
                              AND id NOT IN (SELECT user_id FROM user_credentials)
                        """))
                        conn.commit()
                        logger.info("✅ Migrated existing password hashes to user_credentials table")
                    else:
                        logger.info("ℹ️ Skipping password migration (users.password_hash not present)")
                except Exception as e:
                    conn.rollback()
                    logger.warning(f"⚠️ Password migration skipped: {e}")
                
                # Remove password_hash column from users table (optional - can be done later)
                # For now, we'll keep it for backward compatibility but won't use it
                
                try:
                    conn.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN IF NOT EXISTS github_username VARCHAR
                    """))
                    conn.commit()
                except Exception:
                    pass  # Column may already exist
                
                # Optionally set up pgvector extension and document_vectors table
                # This is non-blocking - if pgvector isn't available, the app will still start
                try:
                    from backend.app.core.config import settings
                    # Enable pgvector extension if available
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                    conn.commit()
                    
                    # Create document_vectors table if it doesn't exist
                    table_name = settings.POSTGRES_VECTOR_TABLE or "document_vectors"
                    embedding_dim = getattr(settings, 'EMBEDDING_DIMENSION', 1024)  # Default to 1024 for Voyage AI
                    conn.execute(text(f"""
                        CREATE TABLE IF NOT EXISTS {table_name} (
                            id SERIAL PRIMARY KEY,
                            content TEXT NOT NULL,
                            metadata JSONB,
                            embedding vector({embedding_dim}),
                            file_name TEXT,
                            source TEXT,
                            user_id TEXT NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """))
                    conn.commit()
                    
                    # Add user_id column if table exists but column doesn't (migration)
                    try:
                        conn.execute(text(f"""
                            ALTER TABLE {table_name}
                            ADD COLUMN IF NOT EXISTS user_id TEXT;
                        """))
                        conn.commit()
                    except Exception:
                        pass  # Column may already exist or migration not needed
                    
                    # Create indexes if they don't exist (non-blocking)
                    try:
                        conn.execute(text(f"""
                            CREATE INDEX IF NOT EXISTS {table_name}_embedding_idx
                            ON {table_name}
                            USING hnsw (embedding vector_cosine_ops)
                            WITH (m = 16, ef_construction = 64);
                        """))
                        conn.commit()
                    except Exception:
                        pass  # Index may already exist or extension not fully available
                    
                    try:
                        conn.execute(text(f"""
                            CREATE INDEX IF NOT EXISTS {table_name}_metadata_idx
                            ON {table_name}
                            USING GIN (metadata);
                        """))
                        conn.commit()
                    except Exception:
                        pass
                    
                    try:
                        conn.execute(text(f"""
                            CREATE INDEX IF NOT EXISTS {table_name}_file_name_idx
                            ON {table_name} (file_name);
                        """))
                        conn.commit()
                    except Exception:
                        pass
                    
                    try:
                        conn.execute(text(f"""
                            CREATE INDEX IF NOT EXISTS {table_name}_user_id_idx
                            ON {table_name} (user_id);
                        """))
                        conn.commit()
                    except Exception:
                        pass

                    try:
                        conn.execute(text(f"""
                            ALTER TABLE {table_name}
                            ADD COLUMN IF NOT EXISTS content_tsv tsvector
                            GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
                        """))
                        conn.execute(text(f"""
                            CREATE INDEX IF NOT EXISTS {table_name}_content_tsv_idx
                            ON {table_name} USING GIN (content_tsv);
                        """))
                        conn.commit()
                    except Exception:
                        pass
                    
                    logger.info(f"✅ pgvector extension and {table_name} table initialized")
                except Exception as e:
                    # pgvector setup is optional - log warning but don't fail
                    logger.warning(f"⚠️ pgvector setup skipped (optional): {e}")
            
            # #region agent log
            try:
                with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "user.py:init_db", "message": "init_db completed successfully", "data": {"attempt": attempt + 1}, "timestamp": int(time.time() * 1000)}) + "\n")
            except: pass
            # #endregion
            logger.info("✅ Database initialized successfully")
            return
            
        except Exception as e:
            # #region agent log
            try:
                with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "user.py:init_db", "message": "Database connection attempt failed", "data": {"attempt": attempt + 1, "error": str(e), "errorType": type(e).__name__, "maxRetries": max_retries}, "timestamp": int(time.time() * 1000)}) + "\n")
            except: pass
            # #endregion
            if attempt < max_retries - 1:
                logger.warning(f"⚠️ Database connection attempt {attempt + 1} failed: {e}. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                # Final attempt failed - log error but don't crash the app
                logger.error(f"❌ Database initialization failed after {max_retries} attempts: {e}")
                logger.warning("⚠️ App will start but database features may not work until connection is restored")
                # #region agent log
                try:
                    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "F", "location": "user.py:init_db", "message": "init_db failed after all retries", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
                except: pass
                # #endregion
                # Don't raise - allow app to start without database
                return

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
