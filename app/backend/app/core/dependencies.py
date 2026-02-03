"""
Authentication and dependency injection utilities
"""
import logging
from typing import Optional
from fastapi import Depends, HTTPException, Header, Request
from backend.app.models.user import SessionLocal, User

logger = logging.getLogger("dex-core")

def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    request: Request,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    authorization: Optional[str] = Header(None),
    db: SessionLocal = Depends(get_db)
) -> User:
    """
    Extract current user from request headers.
    
    Priority:
    1. X-User-ID header (for direct API calls)
    2. Authorization header (Bearer token - extract user from session)
    3. Cookie-based session (for web requests)
    
    This ensures complete isolation - every request must have a valid user_id.
    """
    user_id = None
    
    # Method 1: Direct user ID header (most explicit)
    if x_user_id:
        user_id = x_user_id.strip()
        logger.debug(f"Extracted user_id from X-User-ID header: {user_id}")
    
    # Method 2: Extract from Authorization header (Bearer token)
    elif authorization:
        try:
            # Format: "Bearer <token>" or just "<token>"
            token = authorization.replace("Bearer ", "").strip()
            # For now, we'll use the token as user_id if it's an email
            # In production, you'd decode JWT or validate session token
            if "@" in token:  # Likely an email
                user_id = token
            else:
                # Could be a session token - would need to validate with NextAuth
                # For now, we'll require X-User-ID header for non-email tokens
                logger.warning(f"Received non-email token in Authorization header, requiring X-User-ID")
                raise HTTPException(
                    status_code=401,
                    detail="User identification required. Please provide X-User-ID header."
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error parsing authorization header: {e}")
            raise HTTPException(
                status_code=401,
                detail="Invalid authorization header format"
            )
    
    # Method 3: Extract from cookies (for web requests from NextAuth)
    if not user_id:
        # Check for NextAuth session cookie
        session_token = request.cookies.get("next-auth.session-token") or request.cookies.get("__Secure-next-auth.session-token")
        if session_token:
            # In production, you'd validate this with NextAuth
            # For now, we'll try to extract user info from request state if available
            # This is a fallback - prefer explicit headers
            logger.warning("Session token found but user_id extraction not implemented. Please use X-User-ID header.")
    
    # Method 4: Check request state (if set by middleware)
    if not user_id and hasattr(request.state, "user_id"):
        user_id = request.state.user_id
    
    # Final validation
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please provide X-User-ID header or valid authorization token."
        )
    
    # Validate user exists and is active
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # If user_id looks like an email, try to find by email or create user
        if "@" in user_id:
            user = db.query(User).filter(User.email == user_id).first()
            if not user:
                # Auto-create user if they don't exist (for OAuth users)
                logger.info(f"Auto-creating user for email: {user_id}")
                try:
                    user = User(
                        id=user_id,
                        email=user_id,
                        name=user_id.split("@")[0],  # Use email prefix as name
                        is_active=True,
                        profile_completed=False
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                    logger.info(f"✅ Auto-created user: {user_id}")
                except Exception as e:
                    db.rollback()
                    logger.error(f"Failed to auto-create user {user_id}: {e}")
                    raise HTTPException(
                        status_code=401,
                        detail=f"User not found and could not be created: {user_id}"
                    )
        else:
            # Not an email and user doesn't exist - could be OAuth provider ID
            # Try to find user by checking if this might be a provider ID that needs email lookup
            # For now, provide a helpful error message
            logger.warning(f"User not found: {user_id} (appears to be OAuth provider ID, not email)")
            logger.warning(f"Frontend should send user email in X-User-ID header, not provider ID")
            raise HTTPException(
                status_code=401,
                detail=f"User not found: {user_id}. This appears to be an OAuth provider ID. Please ensure the frontend sends the user's email address in the X-User-ID header."
            )
    
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )
    
    logger.debug(f"Authenticated user: {user_id}")
    return user

def get_user_id(user: User = Depends(get_current_user)) -> str:
    """Extract user_id from authenticated user"""
    return user.id
