"""
Helper functions for querying active users directly from the database.
Useful for background jobs, analytics, or direct database access.
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, nullslast
from typing import List, Optional

from backend.app.models.user import User, get_db

logger = logging.getLogger("dex-core")


def get_active_users(
    db: Session,
    days: int = 30,
    use_last_login: bool = True,
    only_active_accounts: bool = True
) -> List[User]:
    """
    Query active users based on their last login or update time.
    
    Args:
        db: Database session
        days: Number of days to look back for activity (default: 30)
        use_last_login: If True, use last_login; if False, use updated_at (default: True)
        only_active_accounts: If True, only return users with is_active=True (default: True)
    
    Returns:
        List of User objects that were active within the specified period
    
    Example:
        ```python
        from backend.app.models.user import get_db
        from backend.app.services.user_queries import get_active_users
        
        db = next(get_db())
        active_users = get_active_users(db, days=7)  # Last 7 days
        for user in active_users:
            print(f"{user.email} - Last login: {user.last_login}")
        ```
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(User)
    
    # Filter by is_active if requested
    if only_active_accounts:
        query = query.filter(User.is_active == True)
    
    if use_last_login:
        # Use last_login if available, otherwise fall back to updated_at
        query = query.filter(
            (User.last_login >= cutoff_date) | 
            ((User.last_login.is_(None)) & (User.updated_at >= cutoff_date))
        ).order_by(nullslast(desc(User.last_login)), desc(User.updated_at))
    else:
        query = query.filter(User.updated_at >= cutoff_date).order_by(desc(User.updated_at))
    
    return query.all()


def count_active_users(
    db: Session, 
    days: int = 30, 
    use_last_login: bool = True,
    only_active_accounts: bool = True
) -> int:
    """
    Get count of active users.
    
    Args:
        db: Database session
        days: Number of days to look back for activity (default: 30)
        use_last_login: If True, use last_login; if False, use updated_at (default: True)
        only_active_accounts: If True, only count users with is_active=True (default: True)
    
    Returns:
        Count of active users
    
    Example:
        ```python
        from backend.app.models.user import get_db
        from backend.app.services.user_queries import count_active_users
        
        db = next(get_db())
        count = count_active_users(db, days=30)
        print(f"Active users in last 30 days: {count}")
        ```
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(func.count(User.id))
    
    if only_active_accounts:
        query = query.filter(User.is_active == True)
    
    if use_last_login:
        query = query.filter(
            (User.last_login >= cutoff_date) | 
            ((User.last_login.is_(None)) & (User.updated_at >= cutoff_date))
        )
    else:
        query = query.filter(User.updated_at >= cutoff_date)
    
    count = query.scalar()
    return count or 0


def get_users_by_activity_range(
    db: Session,
    start_date: datetime,
    end_date: datetime,
    use_last_login: bool = True,
    only_active_accounts: bool = True
) -> List[User]:
    """
    Get users active within a specific date range.
    
    Args:
        db: Database session
        start_date: Start of the date range
        end_date: End of the date range
        use_last_login: If True, use last_login; if False, use updated_at (default: True)
        only_active_accounts: If True, only return users with is_active=True (default: True)
    
    Returns:
        List of User objects active within the range
    
    Example:
        ```python
        from datetime import datetime, timedelta
        from backend.app.models.user import get_db
        from backend.app.services.user_queries import get_users_by_activity_range
        
        db = next(get_db())
        end = datetime.utcnow()
        start = end - timedelta(days=7)
        users = get_users_by_activity_range(db, start, end)
        ```
    """
    query = db.query(User)
    
    if only_active_accounts:
        query = query.filter(User.is_active == True)
    
    if use_last_login:
        query = query.filter(
            ((User.last_login >= start_date) & (User.last_login <= end_date)) |
            ((User.last_login.is_(None)) & (User.updated_at >= start_date) & (User.updated_at <= end_date))
        ).order_by(nullslast(desc(User.last_login)), desc(User.updated_at))
    else:
        query = query.filter(
            User.updated_at >= start_date,
            User.updated_at <= end_date
        ).order_by(desc(User.updated_at))
    
    return query.all()


def get_all_users(db: Session) -> List[User]:
    """
    Get all users in the database.
    
    Args:
        db: Database session
    
    Returns:
        List of all User objects
    """
    return db.query(User).order_by(User.created_at.desc()).all()


def get_users_with_completed_profiles(
    db: Session,
    only_active: bool = True
) -> List[User]:
    """
    Get users who have completed their profiles.
    
    Args:
        db: Database session
        only_active: If True, only return users with is_active=True (default: True)
    
    Returns:
        List of User objects with profile_completed=True
    """
    query = db.query(User).filter(User.profile_completed == True)
    
    if only_active:
        query = query.filter(User.is_active == True)
    
    return query.order_by(desc(User.updated_at)).all()


def get_inactive_users(db: Session, days: int = 90) -> List[User]:
    """
    Get users who haven't logged in or updated their profile in the specified days.
    
    Args:
        db: Database session
        days: Number of days of inactivity (default: 90)
    
    Returns:
        List of inactive User objects
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    return db.query(User).filter(
        (User.is_active == True) &  # Only check active accounts
        (
            ((User.last_login.is_(None)) | (User.last_login < cutoff_date)) &
            (User.updated_at < cutoff_date)
        )
    ).order_by(desc(User.updated_at)).all()


def update_user_login(db: Session, user_id: str) -> Optional[User]:
    """
    Update the last_login timestamp for a user.
    
    Args:
        db: Database session
        user_id: User ID (email or provider ID)
    
    Returns:
        Updated User object or None if not found
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    
    user.last_login = datetime.utcnow()
    user.is_active = True
    user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    logger.info(f"Updated login timestamp for user: {user_id}")
    return user


def update_user_login_by_email(db: Session, email: str) -> Optional[User]:
    """
    Update the last_login timestamp for a user by email.
    
    Args:
        db: Database session
        email: User email address
    
    Returns:
        Updated User object or None if not found
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    
    user.last_login = datetime.utcnow()
    user.is_active = True
    user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    logger.info(f"Updated login timestamp for user: {email}")
    return user
