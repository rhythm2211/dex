"""
User profile API endpoints
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta

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
    is_active: Optional[bool] = None

class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    age: Optional[int]
    company: Optional[str]
    role: Optional[str]
    bio: Optional[str]
    profile_completed: bool
    is_active: bool
    last_login: Optional[str]
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
        profile_completed=False,
        is_active=True,  # New users are active by default
        last_login=None  # Will be set on first login
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
    if profile.is_active is not None:
        user.is_active = profile.is_active
    
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

@router.get("/users/active", response_model=List[UserProfileResponse])
def get_active_users(
    days: int = Query(30, ge=1, le=365, description="Number of days to look back for activity"),
    use_last_login: bool = Query(True, description="Use last_login instead of updated_at for activity check"),
    db: Session = Depends(get_db)
):
    """
    Get active users based on their last login or update time.
    Users are considered active if:
    1. is_active=True AND
    2. (last_login or updated_at) within the specified number of days
    
    Args:
        days: Number of days to look back (default: 30, max: 365)
        use_last_login: If True, use last_login; if False, use updated_at (default: True)
    
    Returns:
        List of active user profiles
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(User).filter(User.is_active == True)
    
    if use_last_login:
        # Use last_login if available, otherwise fall back to updated_at
        from sqlalchemy import desc, nullslast
        query = query.filter(
            (User.last_login >= cutoff_date) | 
            ((User.last_login.is_(None)) & (User.updated_at >= cutoff_date))
        ).order_by(nullslast(desc(User.last_login)), desc(User.updated_at))
    else:
        query = query.filter(User.updated_at >= cutoff_date).order_by(User.updated_at.desc())
    
    active_users = query.all()
    return [user.to_dict() for user in active_users]

@router.get("/users/active/count")
def get_active_users_count(
    days: int = Query(30, ge=1, le=365, description="Number of days to look back for activity"),
    use_last_login: bool = Query(True, description="Use last_login instead of updated_at for activity check"),
    db: Session = Depends(get_db)
):
    """
    Get count of active users.
    
    Args:
        days: Number of days to look back (default: 30, max: 365)
        use_last_login: If True, use last_login; if False, use updated_at (default: True)
    
    Returns:
        Count of active users
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(func.count(User.id)).filter(User.is_active == True)
    
    if use_last_login:
        query = query.filter(
            (User.last_login >= cutoff_date) | 
            ((User.last_login.is_(None)) & (User.updated_at >= cutoff_date))
        )
    else:
        query = query.filter(User.updated_at >= cutoff_date)
    
    count = query.scalar()
    
    return {
        "active_users_count": count or 0,
        "days_lookback": days,
        "use_last_login": use_last_login,
        "cutoff_date": cutoff_date.isoformat()
    }

@router.post("/users/{user_id}/update-login")
def update_user_login(user_id: str, db: Session = Depends(get_db)):
    """
    Update the last_login timestamp for a user.
    This should be called when a user authenticates.
    
    Args:
        user_id: User ID (email or provider ID)
    
    Returns:
        Updated user profile
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update last_login and set is_active to True
    user.last_login = datetime.utcnow()
    user.is_active = True
    user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    logger.info(f"Updated login timestamp for user: {user_id}")
    return user.to_dict()

@router.post("/users/email/{email}/update-login")
def update_user_login_by_email(email: str, db: Session = Depends(get_db)):
    """
    Update the last_login timestamp for a user by email.
    This should be called when a user authenticates.
    
    Args:
        email: User email address
    
    Returns:
        Updated user profile
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update last_login and set is_active to True
    user.last_login = datetime.utcnow()
    user.is_active = True
    user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    logger.info(f"Updated login timestamp for user: {email}")
    return user.to_dict()
