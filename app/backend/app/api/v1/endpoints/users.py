"""
User profile API endpoints
"""
import logging
import bcrypt
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta

from backend.app.models.user import User, get_db, init_db
from backend.app.services.email_service import email_service

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
    github_username: Optional[str] = None

class UserSignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class UserCredentialsRequest(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    company: Optional[str] = None
    role: Optional[str] = None
    bio: Optional[str] = None
    github_username: Optional[str] = None
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
    github_username: Optional[str]
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
        github_username=profile.github_username,
        profile_completed=False,
        is_active=True,  # New users are active by default
        last_login=None  # Will be set on first login
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    logger.info(f"Created user profile: {profile.email}")
    
    # Send welcome email asynchronously (don't block the response)
    import threading
    def send_email_async():
        try:
            email_service.send_welcome_email(profile.email, profile.name)
        except Exception as e:
            logger.error(f"Failed to send welcome email to {profile.email}: {str(e)}")
    
    # Start email sending in background thread
    email_thread = threading.Thread(target=send_email_async, daemon=True)
    email_thread.start()
    
    return new_user.to_dict()

@router.post("/users/signup", response_model=UserProfileResponse, status_code=201)
def signup_user(signup: UserSignupRequest, db: Session = Depends(get_db)):
    """Create a new user with password (credentials signup)"""
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.id == signup.email) | (User.email == signup.email)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=400, 
            detail="User already exists. Please try logging in instead."
        )
    
    # Hash password
    password_bytes = signup.password.encode('utf-8')
    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
    
    new_user = User(
        id=signup.email,  # Use email as ID
        email=signup.email,
        password_hash=password_hash,
        name=signup.name,
        profile_completed=False,
        is_active=True,
        last_login=None
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    logger.info(f"Created user with credentials: {signup.email}")
    
    # Return response immediately, then send email in background
    # This prevents email service from blocking the signup response
    response_data = new_user.to_dict()
    
    # Send welcome email asynchronously (don't block the response)
    # Use a background task or fire-and-forget approach
    import threading
    def send_email_async():
        try:
            email_service.send_welcome_email(signup.email, signup.name)
        except Exception as e:
            logger.error(f"Failed to send welcome email to {signup.email}: {str(e)}")
            # Don't fail the signup if email fails
    
    # Start email sending in background thread (daemon thread will not block shutdown)
    email_thread = threading.Thread(target=send_email_async, daemon=True)
    email_thread.start()
    
    return response_data

@router.post("/users/verify-credentials")
def verify_credentials(credentials: UserCredentialsRequest, db: Session = Depends(get_db)):
    """Verify user credentials (email/password)"""
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    password_bytes = credentials.password.encode('utf-8')
    password_hash_bytes = user.password_hash.encode('utf-8')
    
    if not bcrypt.checkpw(password_bytes, password_hash_bytes):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    # Update last login
    user.last_login = datetime.utcnow()
    user.is_active = True
    user.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "valid": True,
        "user": user.to_dict()
    }

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
    if profile.github_username is not None:
        user.github_username = profile.github_username
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

@router.get("/users/{user_id}/github/contributions")
def get_github_contributions(user_id: str, db: Session = Depends(get_db)):
    """Get GitHub contribution graph data for user"""
    from backend.app.services.github_service import github_service
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.github_username:
        raise HTTPException(status_code=400, detail="GitHub username not set for this user")
    
    contributions = github_service.get_user_contributions(user.github_username)
    if not contributions:
        raise HTTPException(status_code=404, detail="Failed to fetch GitHub contributions")
    
    return contributions

@router.get("/users/{user_id}/github/repositories")
def get_github_repositories(user_id: str, limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    """Get user's GitHub repositories"""
    from backend.app.services.github_service import github_service
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.github_username:
        raise HTTPException(status_code=400, detail="GitHub username not set for this user")
    
    repos = github_service.get_user_repositories(user.github_username, limit=limit)
    return {"repositories": repos}

@router.get("/users/{user_id}/github/stats")
def get_github_stats(user_id: str, db: Session = Depends(get_db)):
    """Get GitHub user statistics"""
    from backend.app.services.github_service import github_service
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.github_username:
        raise HTTPException(status_code=400, detail="GitHub username not set for this user")
    
    stats = github_service.get_user_stats(user.github_username)
    if not stats:
        raise HTTPException(status_code=404, detail="Failed to fetch GitHub stats")
    
    return stats

@router.get("/users/{user_id}/github/contribution-tree")
def get_github_contribution_tree(user_id: str, db: Session = Depends(get_db)):
    """Get contribution breakdown by repository/folder"""
    from backend.app.services.github_service import github_service
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.github_username:
        raise HTTPException(status_code=400, detail="GitHub username not set for this user")
    
    tree = github_service.get_repository_contributions(user.github_username)
    return {"folders": tree}

@router.get("/users/{user_id}/github/activity")
def get_github_activity(user_id: str, limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    """Get recent GitHub activity"""
    from backend.app.services.github_service import github_service
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.github_username:
        raise HTTPException(status_code=400, detail="GitHub username not set for this user")
    
    activity = github_service.get_recent_activity(user.github_username, limit=limit)
    return {"activity": activity}

@router.post("/users/email/{email}/send-welcome-email")
def send_welcome_email_to_user(email: str, db: Session = Depends(get_db)):
    """
    Send welcome email to a user by email address.
    This endpoint can be called to resend welcome emails or send them for social login users.
    
    Args:
        email: User email address
    
    Returns:
        Success status
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Send welcome email asynchronously
    import threading
    def send_email_async():
        try:
            email_service.send_welcome_email(user.email, user.name)
        except Exception as e:
            logger.error(f"Failed to send welcome email to {user.email}: {str(e)}")
    
    # Start email sending in background thread
    email_thread = threading.Thread(target=send_email_async, daemon=True)
    email_thread.start()
    
    logger.info(f"Welcome email queued for user: {email}")
    return {"success": True, "message": "Welcome email queued"}
