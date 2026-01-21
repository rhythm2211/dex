"""
Migration script to add is_active and last_login fields to existing User table.
Run this once after updating the User model to add the new fields.

Usage:
    python -m backend.app.scripts.migrate_user_fields
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy import text
from backend.app.models.user import engine, User, Base
from backend.app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_user_table():
    """
    Add is_active and last_login columns to the users table if they don't exist.
    This is safe to run multiple times - it checks if columns exist first.
    """
    logger.info("Starting migration: Adding is_active and last_login fields...")
    
    # Check if SQLite (most common case)
    if "sqlite" in settings.DATABASE_URL:
        with engine.connect() as conn:
            # Check if columns exist
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            
            # Add is_active if it doesn't exist
            if "is_active" not in columns:
                logger.info("Adding is_active column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                conn.commit()
                logger.info("✅ Added is_active column")
            else:
                logger.info("✓ is_active column already exists")
            
            # Add last_login if it doesn't exist
            if "last_login" not in columns:
                logger.info("Adding last_login column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN last_login DATETIME"))
                conn.commit()
                logger.info("✅ Added last_login column")
            else:
                logger.info("✓ last_login column already exists")
            
            # Update existing users: set is_active=True for all existing users
            logger.info("Setting is_active=True for all existing users...")
            conn.execute(text("UPDATE users SET is_active = 1 WHERE is_active IS NULL"))
            conn.commit()
            logger.info("✅ Updated existing users")
    
    else:
        # For PostgreSQL, MySQL, etc.
        logger.info("Detected non-SQLite database. Using ALTER TABLE IF NOT EXISTS...")
        with engine.connect() as conn:
            try:
                # Try to add is_active column
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
                """))
                conn.commit()
                logger.info("✅ Added is_active column")
            except Exception as e:
                logger.warning(f"Could not add is_active (may already exist): {e}")
            
            try:
                # Try to add last_login column
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
                """))
                conn.commit()
                logger.info("✅ Added last_login column")
            except Exception as e:
                logger.warning(f"Could not add last_login (may already exist): {e}")
            
            # Update existing users
            try:
                conn.execute(text("UPDATE users SET is_active = TRUE WHERE is_active IS NULL"))
                conn.commit()
                logger.info("✅ Updated existing users")
            except Exception as e:
                logger.warning(f"Could not update existing users: {e}")
    
    logger.info("✅ Migration completed successfully!")
    logger.info("\nNote: You may need to recreate the database tables if using SQLAlchemy's create_all().")
    logger.info("Run: from backend.app.models.user import init_db; init_db()")


if __name__ == "__main__":
    try:
        migrate_user_table()
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
