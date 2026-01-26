"""
Dependencies for API endpoints - User authentication and context extraction
"""
import os
import logging
from typing import Optional
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.app.models.user import User, get_db

logger = logging.getLogger("dex-core")

# Max concurrent users - optimized for single Neo4j instance
# Conservative limit to ensure quality experience
# With optimizations: 15 users is optimal for single Neo4j instance
MAX_CONCURRENT_USERS = int(os.getenv("MAX_CONCURRENT_USERS", "15"))

# Track active users (in-memory for now, can be moved to Redis for production)
_active_users: dict[str, dict] = {}  # user_id -> {last_activity, session_count}

def get_user_from_header(
    x_user_email: Optional[str] = Header(None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Extract user from request headers.
    Frontend should send X-User-Email or X-User-Id header from NextAuth session.
    """
    user_id = None
    user_email = None
    
    # Try to get from headers (preferred method)
    if x_user_email:
        user_email = x_user_email
    elif x_user_id:
        user_id = x_user_id
    
    # Fallback: Try to extract from Authorization header if it contains user info
    # (This is a fallback - NextAuth typically doesn't send user in auth header)
    if not user_email and not user_id and authorization:
        # Could parse JWT token here if needed
        pass
    
    if not user_email and not user_id:
        raise HTTPException(
            status_code=401,
            detail="User authentication required. Please include X-User-Email or X-User-Id header."
        )
    
    # Find user by email or ID
    user = None
    if user_email:
        user = db.query(User).filter(User.email == user_email).first()
    elif user_id:
        user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User not found: {user_email or user_id}"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )
    
    return user

def check_concurrent_user_limit(user: User = Depends(get_user_from_header)) -> User:
    """
    Check if we've reached max concurrent users.
    If limit reached, raise HTTPException with appropriate message.
    """
    import os
    from datetime import datetime, timedelta
    
    MAX_CONCURRENT_USERS = int(os.getenv("MAX_CONCURRENT_USERS", "50"))
    
    # Clean up inactive users (no activity in last 30 minutes)
    current_time = datetime.utcnow()
    inactive_threshold = timedelta(minutes=30)
    
    active_count = 0
    for uid, user_data in list(_active_users.items()):
        if current_time - user_data.get("last_activity", current_time) < inactive_threshold:
            active_count += 1
        else:
            # Remove inactive user
            _active_users.pop(uid, None)
    
    # Check if user is already active
    if user.id in _active_users:
        # Update last activity
        _active_users[user.id]["last_activity"] = current_time
        return user
    
    # Check if we can add new user
    if active_count >= MAX_CONCURRENT_USERS:
        raise HTTPException(
            status_code=503,
            detail=f"Due to free resources and beta testing phase, our current resources are exhausted. Maximum concurrent users ({MAX_CONCURRENT_USERS}) reached. Please try again later."
        )
    
    # Add user to active users
    _active_users[user.id] = {
        "last_activity": current_time,
        "user_email": user.email,
        "session_count": 1
    }
    
    logger.info(f"User {user.email} added to active users. Total active: {len(_active_users)}")
    return user

def get_current_user(user: User = Depends(check_concurrent_user_limit)) -> User:
    """
    Get current authenticated user with concurrent user limit check.
    This is the main dependency to use in endpoints.
    """
    return user
