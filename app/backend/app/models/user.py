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
    name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    company = Column(String, nullable=True)
    role = Column(String, nullable=True)
    bio = Column(String, nullable=True)
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
            "profile_completed": self.profile_completed,
            "is_active": self.is_active,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# Database setup
engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables and run migrations"""
    Base.metadata.create_all(bind=engine)
    
    # Run migration to add is_active and last_login columns if they don't exist
    # This is safe to run multiple times
    from sqlalchemy import text
    import logging
    logger = logging.getLogger("dex-core")
    
    try:
        if "sqlite" in settings.DATABASE_URL:
            with engine.connect() as conn:
                # Check if columns exist
                result = conn.execute(text("PRAGMA table_info(users)"))
                columns = [row[1] for row in result.fetchall()]
                
                # Add is_active if it doesn't exist
                if "is_active" not in columns:
                    logger.info("Adding is_active column to users table...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                    conn.commit()
                
                # Add last_login if it doesn't exist
                if "last_login" not in columns:
                    logger.info("Adding last_login column to users table...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN last_login DATETIME"))
                    conn.commit()
        else:
            # For PostgreSQL, MySQL, etc.
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
    except Exception as e:
        logger.warning(f"Migration check failed (this is OK if tables don't exist yet): {e}")

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
