# Embedding Model Upgrade Guide

## Overview

The RAG system has been upgraded to use a more advanced local embedding model (`sentence-transformers/all-mpnet-base-v2`) instead of the basic `all-MiniLM-L6-v2`. This upgrade significantly improves the system's ability to answer complex questions about architecture, code structure, and codebase relationships.

## What Changed

### 1. **Embedding Model Upgrade**
   - **Old Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, basic quality)
   - **New Model**: `sentence-transformers/all-mpnet-base-v2` (768 dimensions, high quality)
   - **Benefits**:
     - Better semantic understanding of code and architecture
     - Improved retrieval for complex queries
     - Better handling of architecture and structural questions

### 2. **Configuration**
   - Added `EMBEDDING_MODEL_NAME` and `EMBEDDING_DIMENSION` to settings
   - Model is now configurable via environment variables
   - Default: `sentence-transformers/all-mpnet-base-v2` (768 dimensions)

### 3. **Database Schema**
   - Updated to support 768-dimensional embeddings (was 384)
   - Migration script provided for existing databases

### 4. **Retrieval Improvements**
   - Increased default `k_vectors` from 10 to 20 for better coverage
   - Adaptive retrieval: increases to 30 for architecture queries
   - Enhanced graph context retrieval for architecture questions
   - Improved prompt for better architecture question handling

## Migration Steps

### Step 1: Update Environment Variables

Add to your `.env` file (already added if you're using the updated file):

```bash
# Advanced Local Embedding Model Configuration
EMBEDDING_MODEL_NAME=sentence-transformers/all-mpnet-base-v2
EMBEDDING_DIMENSION=768
```

### Step 2: Run Database Migration

**⚠️ IMPORTANT**: This will delete existing embeddings. You must re-ingest your repository after migration.

```bash
cd app/backend
python -m backend.app.scripts.migrate_embeddings
```

Or if you prefer to set up fresh:

```bash
python -m backend.app.scripts.setup_pgvector
```

### Step 3: Re-ingest Your Repository

After migration, you must re-ingest your repository to generate new embeddings with the upgraded model:

1. Go to your DEX dashboard
2. Click "Ingest Repository"
3. Enter your repository URL or path
4. Wait for ingestion to complete

The new embeddings will be 768-dimensional and much more capable of understanding complex queries.

## Available Embedding Models

You can configure different models based on your needs:

| Model | Dimensions | Quality | Speed | Use Case |
|-------|-----------|---------|-------|----------|
| `sentence-transformers/all-MiniLM-L6-v2` | 384 | Basic | Fast | Quick testing |
| `sentence-transformers/all-MiniLM-L12-v2` | 384 | Good | Fast | Balanced (no DB migration needed) |
| `sentence-transformers/all-mpnet-base-v2` | 768 | High | Medium | **Recommended** - Best balance |
| `BAAI/bge-base-en-v1.5` | 768 | Excellent | Medium | Code-focused queries |
| `BAAI/bge-large-en-v1.5` | 1024 | Best | Slow | Maximum quality (requires DB update to 1024) |

To use a different model, update your `.env`:

```bash
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L12-v2
EMBEDDING_DIMENSION=384  # Must match model dimension
```

## Improvements for Architecture Questions

The system now:

1. **Detects architecture queries** automatically (keywords: "architecture", "structure", "design", "explain the", etc.)
2. **Retrieves more context** (30+ chunks instead of 10-20)
3. **Expands graph relationships** more comprehensively
4. **Uses enhanced prompts** that prioritize structural/architectural information
5. **Better handles node path questions** like "Explain more about the path to the selected node"

## Testing

After migration and re-ingestion, test with queries like:

- "Explain the architecture"
- "What is the overall system design?"
- "Explain more about the path to the selected node: display_quick_visualizer"
- "How do components interact in this codebase?"

These should now return comprehensive, well-structured answers instead of "I couldn't find enough context."

## Troubleshooting

### Issue: "Table already has 384 dimensions"
**Solution**: Run the migration script to upgrade to 768 dimensions.

### Issue: "No embeddings found" after migration
**Solution**: Re-ingest your repository. The old 384-dimensional embeddings are incompatible with the new model.

### Issue: Slow embedding generation
**Solution**: The new model is more powerful but slightly slower. This is normal. For faster generation, consider `all-MiniLM-L12-v2` (384 dims, no migration needed).

### Issue: Out of memory during ingestion
**Solution**: The new model uses more memory. Ensure your system has at least 4GB RAM available. You can also reduce batch sizes in `ingestion_service.py`.

## Rollback

If you need to rollback to the old model:

1. Update `.env`:
   ```bash
   EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
   EMBEDDING_DIMENSION=384
   ```

2. Run migration script (it will downgrade the table)

3. Re-ingest your repository

## Performance Notes

- **Embedding Generation**: ~2-3x slower than MiniLM-L6-v2, but much better quality
- **Retrieval Speed**: Similar (database queries are the same)
- **Memory Usage**: ~2x more memory during embedding generation
- **Storage**: ~2x more storage (768 vs 384 dimensions)

The quality improvement is well worth the performance trade-off for production use.
