"""
Diagnostic script to check vector database state.
Run this to see if vectors exist and what dimension they are.

Usage:
    cd app
    python check_vectors.py
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# Add backend to path
BACKEND_DIR = Path(__file__).parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from backend.app.core.config import settings
import psycopg
from psycopg.conninfo import make_conninfo

def check_vectors():
    """Check the state of the vector database."""
    try:
        conninfo = make_conninfo(
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            dbname=settings.POSTGRES_DB
        )
        
        table_name = settings.POSTGRES_VECTOR_TABLE
        expected_dim = getattr(settings, 'EMBEDDING_DIMENSION', 1024)  # Default to 1024 for Voyage/Cohere
        
        print(f"🔍 Checking vector database state...")
        print(f"   Table: {table_name}")
        print(f"   Expected dimension: {expected_dim}")
        print(f"   Model: {getattr(settings, 'EMBEDDING_MODEL_NAME', 'sentence-transformers/all-mpnet-base-v2')}")
        print()
        
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
                    print(f"❌ Table '{table_name}' does not exist!")
                    print(f"   Run: python migrate_embeddings_standalone.py")
                    return False
                
                print(f"✅ Table '{table_name}' exists")
                
                # Check embedding dimension
                cur.execute(f"""
                    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) as type
                    FROM pg_attribute a
                    JOIN pg_class c ON a.attrelid = c.oid
                    WHERE c.relname = '{table_name}' AND a.attname = 'embedding';
                """)
                type_result = cur.fetchone()
                
                if type_result:
                    type_str = type_result[0]
                    import re
                    match = re.search(r'vector\((\d+)\)', type_str)
                    if match:
                        current_dim = int(match.group(1))
                        print(f"   Current dimension: {current_dim}")
                        
                        if current_dim != expected_dim:
                            print(f"⚠️  DIMENSION MISMATCH!")
                            print(f"   Table has {current_dim} dimensions")
                            print(f"   Code expects {expected_dim} dimensions")
                            print(f"   Run migration: python migrate_embeddings_standalone.py")
                            return False
                        else:
                            print(f"✅ Dimension matches: {current_dim}")
                
                # Check vector count
                cur.execute(f"SELECT COUNT(*) FROM {table_name};")
                count = cur.fetchone()[0]
                print(f"   Vector count: {count}")
                
                if count == 0:
                    print(f"⚠️  No vectors in database!")
                    print(f"   You need to ingest a repository.")
                    return False
                else:
                    print(f"✅ {count} vectors found")
                
                # Check sample vector dimension
                if count > 0:
                    cur.execute(f"""
                        SELECT array_length(embedding::float[], 1) as dim
                        FROM {table_name}
                        LIMIT 1;
                    """)
                    sample_dim = cur.fetchone()[0]
                    print(f"   Sample vector dimension: {sample_dim}")
                    
                    if sample_dim != expected_dim:
                        print(f"⚠️  Sample vector dimension mismatch!")
                        print(f"   Sample has {sample_dim} dimensions")
                        print(f"   Expected {expected_dim} dimensions")
                        return False
                
                # Check recent vectors
                cur.execute(f"""
                    SELECT file_name, created_at
                    FROM {table_name}
                    ORDER BY created_at DESC
                    LIMIT 5;
                """)
                recent = cur.fetchall()
                if recent:
                    print(f"\n📄 Recent vectors:")
                    for file_name, created_at in recent:
                        print(f"   - {file_name} ({created_at})")
                
                print(f"\n✅ Database state looks good!")
                return True
                
    except Exception as e:
        print(f"❌ Error checking database: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = check_vectors()
    sys.exit(0 if success else 1)
