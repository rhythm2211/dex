"""
Database migration script to set up pgvector extension and vector table.
Run this script once to initialize the PostgreSQL database for vector storage.

Usage:
    python -m backend.app.scripts.setup_pgvector
"""
import os
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.app.core.config import settings
import psycopg
from psycopg.conninfo import make_conninfo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_pgvector():
    """
    Creates pgvector extension and sets up the document_vectors table.
    """
    try:
        # Build connection string
        conninfo = make_conninfo(
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            dbname=settings.POSTGRES_DB
        )
        
        logger.info(f"Connecting to PostgreSQL at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
        
        with psycopg.connect(conninfo) as conn:
            with conn.cursor() as cur:
                # 1. Enable pgvector extension
                logger.info("Enabling pgvector extension...")
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                conn.commit()
                logger.info("✅ pgvector extension enabled")
                
                # 2. Create or migrate vector table
                # Support configurable embedding dimensions (default: 768 for all-mpnet-base-v2)
                table_name = settings.POSTGRES_VECTOR_TABLE
                embedding_dim = getattr(settings, 'EMBEDDING_DIMENSION', 768)
                logger.info(f"Creating/migrating vector table '{table_name}' with {embedding_dim} dimensions...")
                
                # Check if table exists and get current dimension
                cur.execute(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = '{table_name}'
                    );
                """)
                table_exists = cur.fetchone()[0]
                
                if table_exists:
                    # Check current embedding dimension
                    cur.execute(f"""
                        SELECT atttypmod FROM pg_attribute 
                        WHERE attrelid = '{table_name}'::regclass 
                        AND attname = 'embedding';
                    """)
                    result = cur.fetchone()
                    if result and result[0]:
                        # Extract dimension from typmod (format: -1 for variable, or positive for fixed)
                        # For vector type, typmod contains dimension info
                        cur.execute(f"""
                            SELECT a.atttypmod 
                            FROM pg_attribute a
                            JOIN pg_class c ON a.attrelid = c.oid
                            WHERE c.relname = '{table_name}' AND a.attname = 'embedding';
                        """)
                        typmod_result = cur.fetchone()
                        if typmod_result and typmod_result[0] and typmod_result[0] > 0:
                            current_dim = typmod_result[0]
                            if current_dim != embedding_dim:
                                logger.info(f"⚠️  Table exists with {current_dim} dimensions, but config requires {embedding_dim}.")
                                logger.info(f"⚠️  You need to migrate the table. Dropping and recreating...")
                                # Drop old table and recreate (data will be lost - user should re-ingest)
                                cur.execute(f"DROP TABLE IF EXISTS {table_name} CASCADE;")
                                conn.commit()
                                logger.info(f"✅ Dropped old table. Recreating with {embedding_dim} dimensions...")
                
                # Create table with correct dimensions
                create_table_sql = f"""
                CREATE TABLE IF NOT EXISTS {table_name} (
                    id SERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    metadata JSONB,
                    embedding vector({embedding_dim}),
                    file_name TEXT,
                    source TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
                cur.execute(create_table_sql)
                conn.commit()
                logger.info(f"✅ Table '{table_name}' created")
                
                # 3. Create HNSW index for fast similarity search
                logger.info("Creating HNSW index for vector similarity search...")
                index_name = f"{table_name}_embedding_idx"
                create_index_sql = f"""
                CREATE INDEX IF NOT EXISTS {index_name}
                ON {table_name}
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
                """
                cur.execute(create_index_sql)
                conn.commit()
                logger.info(f"✅ HNSW index '{index_name}' created")
                
                # 4. Create metadata index for faster filtering
                logger.info("Creating metadata index...")
                metadata_index_sql = f"""
                CREATE INDEX IF NOT EXISTS {table_name}_metadata_idx
                ON {table_name}
                USING GIN (metadata);
                """
                cur.execute(metadata_index_sql)
                conn.commit()
                logger.info("✅ Metadata index created")
                
                # 5. Create file_name index for faster lookups
                logger.info("Creating file_name index...")
                file_name_index_sql = f"""
                CREATE INDEX IF NOT EXISTS {table_name}_file_name_idx
                ON {table_name} (file_name);
                """
                cur.execute(file_name_index_sql)
                conn.commit()
                logger.info("✅ File name index created")
                
                logger.info("🎉 pgvector setup completed successfully!")
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
    success = setup_pgvector()
    sys.exit(0 if success else 1)
