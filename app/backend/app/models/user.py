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
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# Database setup
engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
