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
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables and run migrations"""
    Base.metadata.create_all(bind=engine)
    
    # Run migration to add is_active and last_login columns if they don't exist
    # This is safe to run multiple times (PostgreSQL only)
    from sqlalchemy import text
    import logging
    logger = logging.getLogger("dex-core")
    
    try:
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
    except Exception as e:
        logger.warning(f"Migration check failed (this is OK if tables don't exist yet): {e}")

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
