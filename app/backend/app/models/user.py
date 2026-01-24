"""
User database models and schema
"""
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from backend.app.core.config import settings

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)  # NextAuth user ID (email or provider ID)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)  # Hashed password for credentials auth
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

# Database setup - PostgreSQL only
# Add connect_args to prefer IPv4 and handle connection issues
# Note: If using connection pooler (port 6543), it should handle IPv4 automatically
engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping=True, 
    pool_size=5, 
    max_overflow=10,
    connect_args={
        "connect_timeout": 10,  # 10 second timeout
        "options": "-c statement_timeout=30000",  # 30 second statement timeout
        # Try to force IPv4 by using the resolved IP if available
        # If hostname is used, psycopg2 will do its own resolution
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables and run migrations"""
    from sqlalchemy import text
    import logging
    import time
    logger = logging.getLogger("dex-core")
    
    # Retry logic for database connection (handles network issues)
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            # Test connection first
            with engine.connect() as test_conn:
                test_conn.execute(text("SELECT 1"))
            
            # Connection successful, proceed with initialization
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
                
                try:
                    conn.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN IF NOT EXISTS password_hash VARCHAR
                    """))
                    conn.commit()
                except Exception:
                    pass  # Column may already exist
                
                try:
                    conn.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN IF NOT EXISTS github_username VARCHAR
                    """))
                    conn.commit()
                except Exception:
                    pass  # Column may already exist
            
            logger.info("✅ Database initialized successfully")
            return
            
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"⚠️ Database connection attempt {attempt + 1} failed: {e}. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                # Final attempt failed - log error but don't crash the app
                logger.error(f"❌ Database initialization failed after {max_retries} attempts: {e}")
                logger.warning("⚠️ App will start but database features may not work until connection is restored")
                # Don't raise - allow app to start without database
                return

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
