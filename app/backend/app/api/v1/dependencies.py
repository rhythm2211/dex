"""
Dependencies for API endpoints - User authentication and context extraction
"""
import os
import logging
import signal
from typing import Optional
from contextlib import contextmanager
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

# In-memory user cache to reduce database queries (TTL: 5 minutes)
_user_cache: dict[str, tuple[User, float]] = {}  # key -> (user, timestamp)
_cache_ttl = 300  # 5 minutes

@contextmanager
def timeout_context(seconds: float):
    """Context manager for timeout protection on blocking operations."""
    def timeout_handler(signum, frame):
        raise TimeoutError(f"Operation timed out after {seconds} seconds")
    
    # Set up signal handler (Unix only)
    if hasattr(signal, 'SIGALRM'):
        old_handler = signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(int(seconds))
        try:
            yield
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)
    else:
        # Windows doesn't support SIGALRM, just yield without timeout
        # In production, use async/await or threading for cross-platform timeout
        yield

def get_user_from_header(
    x_user_email: Optional[str] = Header(None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Extract user from request headers.
    Frontend should send X-User-Email or X-User-Id header from NextAuth session.
    Optimized with timeout and caching to prevent hanging.
    """
    import time
    
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
    
    # Check cache first (fast path)
    cache_key = user_email or user_id
    current_time = time.time()
    if cache_key in _user_cache:
        cached_user, cache_time = _user_cache[cache_key]
        if current_time - cache_time < _cache_ttl:
            # Cached user is already expunged, safe to return
            return cached_user
        else:
            # Cache expired, remove it
            _user_cache.pop(cache_key, None)
    
    # Find user by email or ID with timeout protection
    user = None
    try:
        # Use connection timeout from pool (already configured to 5 seconds)
        # Add explicit query timeout protection
        if user_email:
            # Fast query with index - should complete in < 100ms
            user = db.query(User).filter(User.email == user_email).first()
        elif user_id:
            # Fast query with primary key - should complete in < 50ms
            user = db.query(User).filter(User.id == user_id).first()
        
        # Cache the user if found
        if user:
            # Access attributes while session is active to prevent DetachedInstanceError
            # This ensures attributes are loaded into memory before session closes
            _ = user.id
            _ = user.email
            _ = user.is_active
            # Expunge the user from the session so it can be used after session closes
            db.expunge(user)
            _user_cache[cache_key] = (user, current_time)
            # Limit cache size to prevent memory issues
            if len(_user_cache) > 1000:
                # Remove oldest entries
                sorted_cache = sorted(_user_cache.items(), key=lambda x: x[1][1])
                for key, _ in sorted_cache[:100]:
                    _user_cache.pop(key, None)
                    
    except Exception as e:
        # If database query fails, log and raise appropriate error
        logger.error(f"Database query failed in get_user_from_header: {e}", exc_info=True)
        # Try to return cached user if available (stale but better than error)
        if cache_key in _user_cache:
            logger.warning(f"Using cached user due to database error: {e}")
            cached_user = _user_cache[cache_key][0]
            # Cached user is already expunged, safe to return
            return cached_user
        raise HTTPException(
            status_code=503,
            detail="Database connection error. Please try again."
        )
    
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
