"""
Standalone migration script to upgrade embedding dimensions from 384 to 768.
This script can be run directly from the app/ directory.

WARNING: This will require re-ingestion of your repository data!
The existing 384-dimensional embeddings are incompatible with 768-dimensional embeddings.

Usage:
    cd app
    python migrate_embeddings_standalone.py
"""
import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
    logging.info(f"Loaded .env from {env_path}")

# Add backend to path
BACKEND_DIR = Path(__file__).parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from backend.app.core.config import settings
import psycopg
from psycopg.conninfo import make_conninfo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_embeddings():
    """
    Migrates the document_vectors table from 384 to 768 dimensions.
    This requires dropping the old table and recreating it.
    """
    try:
        conninfo = make_conninfo(
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            dbname=settings.POSTGRES_DB
        )
        
        logger.info(f"Connecting to PostgreSQL at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
        
        table_name = settings.POSTGRES_VECTOR_TABLE
        new_dim = getattr(settings, 'EMBEDDING_DIMENSION', 768)
        
        with psycopg.connect(conninfo) as conn:
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
                    # Create table directly
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
                    
                    # Create indexes
                    cur.execute(f"CREATE EXTENSION IF NOT EXISTS vector;")
                    conn.commit()
                    
                    index_name = f"{table_name}_embedding_idx"
                    cur.execute(f"""
                        CREATE INDEX {index_name}
                        ON {table_name}
                        USING hnsw (embedding vector_cosine_ops)
                        WITH (m = 16, ef_construction = 64);
                    """)
                    conn.commit()
                    
                    cur.execute(f"""
                        CREATE INDEX {table_name}_metadata_idx
                        ON {table_name}
                        USING GIN (metadata);
                    """)
                    conn.commit()
                    
                    cur.execute(f"""
                        CREATE INDEX {table_name}_file_name_idx
                        ON {table_name} (file_name);
                    """)
                    conn.commit()
                    
                    logger.info("🎉 Setup completed successfully!")
                    return True
                
                # Get current dimension
                logger.info(f"Checking current embedding dimension for table '{table_name}'...")
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
        logger.error("Please ensure:")
        logger.error("  1. PostgreSQL is running")
        logger.error("  2. Database exists")
        logger.error("  3. Connection credentials are correct in .env")
        return False
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = migrate_embeddings()
    sys.exit(0 if success else 1)
