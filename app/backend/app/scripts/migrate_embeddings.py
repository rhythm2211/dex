"""
Migration script to upgrade embedding dimensions to match the configured model.
This script migrates the document_vectors table to support the new embedding model.

WARNING: This will require re-ingestion of your repository data!
Embeddings with different dimensions are incompatible (e.g., 384 vs 768 vs 1024).

Usage:
    # From app/backend directory:
    python -m app.scripts.migrate_embeddings
    
    # Or directly:
    python app/scripts/migrate_embeddings.py
"""
import os
import sys
import logging
from pathlib import Path

# Get the script's directory
SCRIPT_DIR = Path(__file__).resolve().parent
# Go up: scripts -> app -> backend -> app
BACKEND_DIR = SCRIPT_DIR.parent.parent
APP_DIR = BACKEND_DIR.parent  # app/ directory

# Add both backend and app to path
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(APP_DIR))

# Try importing - handle both possible structures
try:
    from backend.app.core.config import settings
except ImportError:
    # Alternative import path
    from app.core.config import settings

import psycopg

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_embeddings():
    """
    Migrates the document_vectors table to the dimension specified in EMBEDDING_DIMENSION.
    Supports migration to any dimension (e.g., 384, 768, 1024).
    This requires dropping the old table and recreating it.
    """
    try:
        logger.info(f"Connecting to PostgreSQL at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
        
        table_name = settings.POSTGRES_VECTOR_TABLE
        new_dim = getattr(settings, 'EMBEDDING_DIMENSION', 1024)  # Default to 1024 for Voyage AI
        
        # Use settings.POSTGRES_CONNECTION_STRING so Neon pooler endpoint options are included.
        with psycopg.connect(settings.POSTGRES_CONNECTION_STRING) as conn:
            with conn.cursor() as cur:
                # Check if table exists
                cur.execute(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = '{table_name}'
                    );
                """)
                table_exists = cur.fetchone()[0]
                
                if not table_exists:
                    logger.info(f"Table '{table_name}' does not exist. Creating with {new_dim} dimensions...")
                    # Use setup_pgvector script logic
                    from backend.app.scripts.setup_pgvector import setup_pgvector
                    return setup_pgvector()
                
                # Check current dimension
                logger.info(f"Checking current embedding dimension for table '{table_name}'...")
                cur.execute(f"""
                    SELECT column_name, data_type, 
                           CASE 
                               WHEN data_type = 'USER-DEFINED' THEN 
                                   (SELECT typname FROM pg_type WHERE oid = (
                                       SELECT atttypid FROM pg_attribute 
                                       WHERE attrelid = '{table_name}'::regclass 
                                       AND attname = 'embedding'
                                   ))
                               ELSE data_type
                           END as actual_type
                    FROM information_schema.columns 
                    WHERE table_name = '{table_name}' AND column_name = 'embedding';
                """)
                
                result = cur.fetchone()
                if not result:
                    logger.error(f"Could not find 'embedding' column in table '{table_name}'")
                    return False
                
                # Get vector dimension by checking the constraint
                cur.execute(f"""
                    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) as type
                    FROM pg_attribute a
                    JOIN pg_class c ON a.attrelid = c.oid
                    WHERE c.relname = '{table_name}' AND a.attname = 'embedding';
                """)
                type_result = cur.fetchone()
                
                if type_result:
                    type_str = type_result[0]
                    # Extract dimension from type string like "vector(384)"
                    import re
                    match = re.search(r'vector\((\d+)\)', type_str)
                    if match:
                        current_dim = int(match.group(1))
                        logger.info(f"Current embedding dimension: {current_dim}")
                        
                        if current_dim == new_dim:
                            logger.info(f"✅ Table already has {new_dim} dimensions. No migration needed.")
                            return True
                        
                        # Count existing records
                        cur.execute(f"SELECT COUNT(*) FROM {table_name};")
                        record_count = cur.fetchone()[0]
                        
                        if record_count > 0:
                            logger.warning(f"⚠️  WARNING: Table contains {record_count} records with {current_dim}-dimensional embeddings.")
                            logger.warning(f"⚠️  Migrating to {new_dim} dimensions will DELETE all existing data!")
                            logger.warning(f"⚠️  You will need to re-ingest your repository after migration.")
                            
                            response = input(f"\n⚠️  Do you want to proceed? This will DELETE {record_count} records. (yes/no): ")
                            if response.lower() != 'yes':
                                logger.info("Migration cancelled by user.")
                                return False
                        
                        # Drop old table and indexes
                        logger.info(f"Dropping old table '{table_name}'...")
                        cur.execute(f"DROP TABLE IF EXISTS {table_name} CASCADE;")
                        conn.commit()
                        logger.info(f"✅ Old table dropped")
                
                # Recreate table with new dimensions
                logger.info(f"Creating new table '{table_name}' with {new_dim} dimensions...")
                create_table_sql = f"""
                CREATE TABLE {table_name} (
                    id SERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    metadata JSONB,
                    embedding vector({new_dim}),
                    file_name TEXT,
                    source TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
                cur.execute(create_table_sql)
                conn.commit()
                logger.info(f"✅ Table '{table_name}' created with {new_dim} dimensions")
                
                # Recreate indexes
                logger.info("Recreating indexes...")
                
                # HNSW index
                index_name = f"{table_name}_embedding_idx"
                create_index_sql = f"""
                CREATE INDEX {index_name}
                ON {table_name}
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
                """
                cur.execute(create_index_sql)
                conn.commit()
                logger.info(f"✅ HNSW index '{index_name}' created")
                
                # Metadata index
                metadata_index_sql = f"""
                CREATE INDEX {table_name}_metadata_idx
                ON {table_name}
                USING GIN (metadata);
                """
                cur.execute(metadata_index_sql)
                conn.commit()
                logger.info("✅ Metadata index created")
                
                # File name index
                file_name_index_sql = f"""
                CREATE INDEX {table_name}_file_name_idx
                ON {table_name} (file_name);
                """
                cur.execute(file_name_index_sql)
                conn.commit()
                logger.info("✅ File name index created")
                
                logger.info("🎉 Migration completed successfully!")
                logger.info("⚠️  IMPORTANT: You must re-ingest your repository to populate the new embeddings!")
                return True
                
    except psycopg.OperationalError as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = migrate_embeddings()
    sys.exit(0 if success else 1)
