"""
User profile API endpoints
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.models.user import User, get_db, init_db

logger = logging.getLogger("dex-core")

router = APIRouter()

# Initialize database on import
init_db()

# Request/Response Models
class UserProfileCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    age: Optional[int] = None
    company: Optional[str] = None
    role: Optional[str] = None
    bio: Optional[str] = None

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    company: Optional[str] = None
    role: Optional[str] = None
    bio: Optional[str] = None
    profile_completed: Optional[bool] = None

class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    age: Optional[int]
    company: Optional[str]
    role: Optional[str]
    bio: Optional[str]
    profile_completed: bool
    created_at: Optional[str]
    updated_at: Optional[str]

# Endpoints
@router.get("/users/{user_id}", response_model=UserProfileResponse)
def get_user_profile(user_id: str, db: Session = Depends(get_db)):
    """Get user profile by ID (email or provider ID)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.to_dict()

@router.get("/users/email/{email}", response_model=UserProfileResponse)
def get_user_by_email(email: str, db: Session = Depends(get_db)):
    """Get user profile by email"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.to_dict()

@router.post("/users", response_model=UserProfileResponse, status_code=201)
def create_user_profile(profile: UserProfileCreate, db: Session = Depends(get_db)):
    """Create a new user profile"""
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.id == profile.email) | (User.email == profile.email)
    ).first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_user = User(
        id=profile.email,  # Use email as ID for now
        email=profile.email,
        name=profile.name,
        age=profile.age,
        company=profile.company,
        role=profile.role,
        bio=profile.bio,
        profile_completed=False
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    logger.info(f"Created user profile: {profile.email}")
    return new_user.to_dict()

@router.put("/users/{user_id}", response_model=UserProfileResponse)
def update_user_profile(user_id: str, profile: UserProfileUpdate, db: Session = Depends(get_db)):
    """Update user profile"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update only provided fields
    if profile.name is not None:
        user.name = profile.name
    if profile.age is not None:
        user.age = profile.age
    if profile.company is not None:
        user.company = profile.company
    if profile.role is not None:
        user.role = profile.role
    if profile.bio is not None:
        user.bio = profile.bio
    if profile.profile_completed is not None:
        user.profile_completed = profile.profile_completed
    
    from datetime import datetime
    user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    logger.info(f"Updated user profile: {user_id}")
    return user.to_dict()

@router.get("/users/{user_id}/profile-completed")
def check_profile_completed(user_id: str, db: Session = Depends(get_db)):
    """Check if user profile is completed"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"profile_completed": False, "exists": False}
    
    return {
        "profile_completed": user.profile_completed,
        "exists": True
    }
