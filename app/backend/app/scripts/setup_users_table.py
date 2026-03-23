"""
Database migration script to set up users table in PostgreSQL.
Run this script once to initialize the users table for user storage.

Usage:
    python -m backend.app.scripts.setup_users_table
"""
import os
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.app.core.config import settings
from backend.app.models.user import Base, engine
import psycopg

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_users_table():
    """
    Creates the users table in PostgreSQL.
    """
    try:
        logger.info(f"Connecting to PostgreSQL at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
        
        # Create tables using SQLAlchemy
        logger.info("Creating users table...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Users table created")
        
        # Verify table exists and check structure.
        # Use settings.POSTGRES_CONNECTION_STRING so Neon pooler endpoint options are included.
        with psycopg.connect(settings.POSTGRES_CONNECTION_STRING) as conn:
            with conn.cursor() as cur:
                # Check if table exists
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'users'
                    );
                """)
                exists = cur.fetchone()[0]
                
                if exists:
                    logger.info("✅ Users table verified")
                    
                    # Check columns
                    cur.execute("""
                        SELECT column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_name = 'users'
                        ORDER BY ordinal_position;
                    """)
                    columns = cur.fetchall()
                    logger.info(f"✅ Table has {len(columns)} columns:")
                    for col_name, col_type in columns:
                        logger.info(f"   - {col_name}: {col_type}")
                else:
                    logger.error("❌ Users table not found after creation")
                    return False
        
        logger.info("🎉 Users table setup completed successfully!")
        return True
                
    except psycopg.OperationalError as e:
        logger.error(f"❌ Database connection failed: {e}")
        logger.error("Please ensure:")
        logger.error("  1. PostgreSQL is running")
        logger.error("  2. Database exists (create it manually if needed)")
        logger.error("  3. Connection credentials are correct in .env")
        return False
    except Exception as e:
        logger.error(f"❌ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = setup_users_table()
    sys.exit(0 if success else 1)
