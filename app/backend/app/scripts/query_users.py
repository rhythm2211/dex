"""
Script to query PostgreSQL database for total users count and display top 5 users.

Usage:
    python -m backend.app.scripts.query_users
"""
import os
import sys
import logging
from pathlib import Path
from sqlalchemy import func, desc
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.app.core.config import settings
from backend.app.models.user import User, SessionLocal

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def format_datetime(dt):
    """Format datetime for display"""
    if dt:
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return "N/A"


def display_user_details(user, index):
    """Display formatted user details"""
    print(f"\n{'='*80}")
    print(f"User #{index + 1}")
    print(f"{'='*80}")
    print(f"ID:              {user.id}")
    print(f"Email:           {user.email}")
    print(f"Name:            {user.name or 'N/A'}")
    print(f"Age:             {user.age or 'N/A'}")
    print(f"Company:         {user.company or 'N/A'}")
    print(f"Role:            {user.role or 'N/A'}")
    print(f"Bio:             {user.bio or 'N/A'}")
    print(f"Profile Completed: {'Yes' if user.profile_completed else 'No'}")
    print(f"Is Active:       {'Yes' if user.is_active else 'No'}")
    print(f"Last Login:      {format_datetime(user.last_login)}")
    print(f"Created At:      {format_datetime(user.created_at)}")
    print(f"Updated At:      {format_datetime(user.updated_at)}")


def query_users():
    """
    Query the database for total users count and display top 5 users.
    """
    try:
        logger.info(f"Connecting to PostgreSQL at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
        
        # Create database session
        db = SessionLocal()
        
        try:
            # Get total users count
            total_count = db.query(func.count(User.id)).scalar()
            logger.info(f"\n{'='*80}")
            logger.info(f"TOTAL USERS COUNT: {total_count}")
            logger.info(f"{'='*80}")
            
            if total_count == 0:
                logger.info("\nNo users found in the database.")
                return
            
            # Get top 5 users (ordered by created_at descending - most recent first)
            top_users = db.query(User).order_by(desc(User.created_at)).limit(5).all()
            
            logger.info(f"\nDisplaying details of top 5 users (most recently created):")
            
            # Display each user's details
            for index, user in enumerate(top_users):
                display_user_details(user, index)
            
            print(f"\n{'='*80}")
            logger.info(f"\nQuery completed successfully!")
            return True
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Query failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = query_users()
    sys.exit(0 if success else 1)
