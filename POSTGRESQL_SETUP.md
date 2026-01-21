# PostgreSQL + pgvector Setup Guide

This guide explains how to set up PostgreSQL with the pgvector extension to replace Pinecone for vector storage.

## Prerequisites

- PostgreSQL 12+ installed and running
- Python 3.8+ with pip
- Access to create databases and extensions

## Step 1: Install PostgreSQL

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Docker (Recommended)
```bash
docker run --name dex-postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=dex \
  -p 5432:5432 \
  -d pgvector/pgvector:pg16
```

## Step 2: Install pgvector Extension

The pgvector extension must be installed in your PostgreSQL database.

### Option A: Using pgvector Docker Image (Easiest)
The Docker image `pgvector/pgvector:pg16` already includes the extension.

### Option B: Manual Installation
```bash
# Clone pgvector repository
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector

# Compile and install
make
sudo make install

# Connect to PostgreSQL and enable extension
psql -U postgres -d dex
CREATE EXTENSION vector;
```

## Step 3: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE dex;

# Connect to the new database
\c dex

# Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# Exit
\q
```

## Step 4: Configure Environment Variables

Update your `.env` file in `app/.env`:

```bash
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=dex
POSTGRES_VECTOR_TABLE=document_vectors

# Other required variables
GROQ_API_KEY=your_groq_key
NEO4J_URI=your_neo4j_uri
NEO4J_USERNAME=your_neo4j_username
NEO4J_PASSWORD=your_neo4j_password
```

## Step 5: Run Database Migration

Run the setup script to create the vector table and indexes:

```bash
cd app/backend
python -m backend.app.scripts.setup_pgvector
```

This will:
- Verify pgvector extension is enabled
- Create the `document_vectors` table
- Create HNSW index for fast similarity search
- Create metadata and file_name indexes

## Step 6: Verify Installation

Test the connection:

```bash
python -c "
import psycopg
from backend.app.core.config import settings
from psycopg.conninfo import make_conninfo

conninfo = make_conninfo(
    host=settings.POSTGRES_HOST,
    port=settings.POSTGRES_PORT,
    user=settings.POSTGRES_USER,
    password=settings.POSTGRES_PASSWORD,
    dbname=settings.POSTGRES_DB
)

with psycopg.connect(conninfo) as conn:
    with conn.cursor() as cur:
        cur.execute('SELECT extname FROM pg_extension WHERE extname = %s', ('vector',))
        result = cur.fetchone()
        if result:
            print('✅ pgvector extension is enabled')
        else:
            print('❌ pgvector extension not found')
        
        cur.execute('SELECT COUNT(*) FROM document_vectors')
        count = cur.fetchone()[0]
        print(f'✅ Vector table exists with {count} records')
"
```

## Troubleshooting

### Connection Refused
- Ensure PostgreSQL is running: `sudo systemctl status postgresql` (Linux) or `brew services list` (macOS)
- Check if PostgreSQL is listening on the correct port: `netstat -an | grep 5432`
- Verify firewall settings

### Extension Not Found
- Ensure pgvector is installed: `psql -U postgres -d dex -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"`
- If not available, install pgvector manually (see Step 2)

### Permission Denied
- Ensure the PostgreSQL user has CREATE and USAGE privileges on the database
- Grant necessary permissions: `GRANT ALL PRIVILEGES ON DATABASE dex TO postgres;`

### Table Already Exists
- If you need to start fresh, drop and recreate:
  ```sql
  DROP TABLE IF EXISTS document_vectors CASCADE;
  ```
- Then run the setup script again

## Performance Tuning

### HNSW Index Parameters
The default HNSW index uses:
- `m = 16`: Number of connections per layer
- `ef_construction = 64`: Size of candidate list during construction

For larger datasets, you may want to adjust these:
```sql
DROP INDEX document_vectors_embedding_idx;
CREATE INDEX document_vectors_embedding_idx
ON document_vectors
USING hnsw (embedding vector_cosine_ops)
WITH (m = 32, ef_construction = 128);
```

### Connection Pooling
Consider using a connection pooler like PgBouncer for production:
```bash
# Install PgBouncer
sudo apt install pgbouncer

# Configure in /etc/pgbouncer/pgbouncer.ini
[databases]
dex = host=localhost port=5432 dbname=dex

[pgbouncer]
listen_port = 6432
pool_mode = transaction
```

## Migration from Pinecone

If you're migrating from Pinecone:

1. **Backup existing data** (if needed)
2. **Update environment variables** (remove Pinecone, add PostgreSQL)
3. **Run database setup** (Step 5)
4. **Re-run ingestion** to populate the new vector store
5. **Verify queries work** with the new setup

## Production Considerations

- Use managed PostgreSQL services (AWS RDS, Google Cloud SQL, Azure Database) with pgvector support
- Enable connection pooling
- Set up regular backups
- Monitor query performance and adjust indexes as needed
- Consider read replicas for scaling

## Additional Resources

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [pgvector Documentation](https://github.com/pgvector/pgvector#documentation)
- [LangChain PGVector](https://python.langchain.com/docs/integrations/vectorstores/pgvector)
