# Capacity Analysis: Parallel Ingestion Sessions

## Overview

This document analyzes the capacity limits of the free architecture for handling parallel ingestion sessions without crashes or 429 errors.

## Quick Summary: Railway Hobby Plan + Free Tier Databases

**Current Setup:**
- **Railway Hobby Plan**: 48GB RAM / 48 vCPU ✅ (NOT a bottleneck)
- **Neon PostgreSQL Free**: 100 concurrent connections ⚠️ (PRIMARY BOTTLENECK)
- **Neo4j Aura Free**: 50 concurrent connections ⚠️ (SECONDARY BOTTLENECK)

**Realistic Capacity with FREE TIER databases:**
- **Recommended**: **20 parallel ingestion sessions** (safe, stable)
- **Maximum**: **25-30 sessions** (risky, may hit Neo4j limits)
- **Railway Resources**: Only using 8-12% (plenty of headroom)

**Key Insight**: With connection pooling, each session uses ~1-2 connections (not 5!), allowing more sessions within free tier limits.

See `FREE_TIER_CAPACITY.md` for detailed analysis.

## Free Tier Service Limits

### 1. **Neo4j Aura Free Tier**
- **Nodes**: 50,000 nodes per database
- **Relationships**: 175,000 relationships per database
- **Connections**: ~50 concurrent connections
- **Storage**: ~1GB
- **Note**: With user isolation, each user's data counts toward the total limit

### 2. **PostgreSQL (Neon/Supabase Free Tier)**
- **Storage**: 0.5GB (Neon) or 500MB (Supabase)
- **Connections**: 100 concurrent connections (Neon) or 60 (Supabase)
- **Compute**: Limited CPU/memory
- **Note**: Connection pooling helps, but each ingestion process needs connections

### 3. **Groq API (Free Tier)**
- **Rate Limit**: ~30 requests/minute (varies by model)
- **Concurrent Requests**: Limited
- **Note**: Used for RAG queries, not ingestion (unless using LLM for parsing)

### 4. **Railway (Backend Hosting)**

#### Free Tier:
- **Free Credit**: $5/month (~500 hours runtime)
- **Memory**: ~512MB-1GB per instance
- **CPU**: Limited (shared)
- **Note**: Can run 24/7 on free tier if usage is low

#### Hobby Plan ($5/month):
- **Memory**: Up to 48GB RAM per service (MASSIVE increase!)
- **CPU**: Up to 48 vCPU per service
- **Replicas**: Up to 5 replicas at 8 vCPU / 8 GB RAM per replica
- **Monitoring**: Logging, metrics, alerting (7 days retention)
- **Note**: Production-grade resources - can scale significantly!

### 5. **Vercel (Frontend)**
- **Bandwidth**: 100GB/month
- **Function Execution**: 100GB-hours/month
- **Note**: Not a bottleneck for ingestion

## Bottleneck Analysis

### Primary Bottlenecks (in order of impact):

1. **PostgreSQL Connection Pool** ⚠️ **CRITICAL**
   - Each ingestion process needs 2-5 database connections
   - Free tier: 60-100 total connections
   - **Capacity**: ~12-20 parallel ingestion sessions (assuming 5 connections each)
   - **Recommendation**: Use connection pooling, limit to 10-15 parallel sessions

2. **Neo4j Connection Pool** ⚠️ **HIGH**
   - Each ingestion process needs 1-2 Neo4j connections
   - Free tier: ~50 concurrent connections
   - **Capacity**: ~25-30 parallel ingestion sessions
   - **Recommendation**: Limit to 20 parallel sessions for safety margin

3. **Memory (Per Ingestion Process)** ✅ **NOT A BOTTLENECK** (with Hobby Plan)
   - Each ingestion: ~200-500MB memory (optimized: 150-300MB)
   - Railway free tier: ~512MB-1GB total → **Capacity: 2-3 sessions**
   - Railway hobby plan: **48GB RAM** → **Capacity: 160-320 sessions** (with optimization)
   - **Recommendation**: Memory is no longer a constraint with Hobby Plan!

4. **CPU (Embedding Generation)** ✅ **NOT A BOTTLENECK** (with Hobby Plan)
   - Embedding generation is CPU-intensive
   - Free tier: Limited CPU (shared) → **Capacity: 3-5 parallel**
   - Railway hobby plan: **48 vCPU** → **Capacity: 50-100+ parallel** (with proper async)
   - **Recommendation**: CPU is no longer a constraint with Hobby Plan!

5. **Storage (PostgreSQL)** ⚠️ **LOW-MEDIUM**
   - Each repository: ~10-50MB of vectors (depends on codebase size)
   - Free tier: 500MB total
   - **Capacity**: ~10-50 repositories (depends on size)
   - **Recommendation**: Monitor storage, clean up old data

6. **Neo4j Storage** ⚠️ **LOW**
   - Each repository: ~5-20MB of graph data
   - Free tier: ~1GB total
   - **Capacity**: ~50-200 repositories
   - **Recommendation**: Usually not a bottleneck

## Recommended Limits

### Free Tier:

#### Conservative (Safe for Free Tier):
- **Parallel Ingestion Sessions**: **3-5 sessions**
- **Rationale**: 
  - Memory: 3-5 × 300MB = 900MB-1.5GB (within Railway limits)
  - PostgreSQL: 3-5 × 5 connections = 15-25 connections (safe)
  - Neo4j: 3-5 × 2 connections = 6-10 connections (safe)
  - CPU: Manageable with async processing

#### Moderate (With Monitoring):
- **Parallel Ingestion Sessions**: **5-10 sessions**
- **Rationale**:
  - Requires connection pooling optimization
  - May need to monitor memory usage
  - Risk of hitting PostgreSQL connection limits

#### Aggressive (Not Recommended on Free Tier):
- **Parallel Ingestion Sessions**: **10+ sessions**
- **Risks**:
  - High chance of hitting PostgreSQL connection limits (429 errors)
  - Memory pressure on Railway
  - Potential crashes

### Railway Hobby Plan ($5/month) - **ACTUAL SPECS: 48GB RAM / 48 vCPU**:

#### ⚠️ IMPORTANT: With FREE TIER DATABASES

**Database Connection Limits:**
- **Neon PostgreSQL Free**: 100 concurrent connections max
- **Neo4j Aura Free**: 50 concurrent connections max
- **Railway Hobby**: NOT a bottleneck (48GB RAM / 48 vCPU)

**With Connection Pooling (Optimized):**
- Each session uses ~1-2 PostgreSQL connections (not 5!)
- Each session uses ~1 Neo4j connection (not 2!)
- Connection pooling allows sharing - sessions don't hold connections when idle

#### Conservative (Safe for Free Tier):
- **Parallel Ingestion Sessions**: **20 sessions**
- **Rationale**:
  - Memory: 20 × 200MB = 4GB (8% of 48GB) ✅
  - CPU: 20 sessions (20-30% of 48 vCPU) ✅
  - PostgreSQL: 20 × 2 = 40 connections (40% of 100 limit) ✅
  - Neo4j: 20 × 1 = 20 connections (40% of 50 limit) ✅
  - **Recommendation**: Start here, safe and stable

#### Moderate (Pushing Free Tier Limits):
- **Parallel Ingestion Sessions**: **25 sessions**
- **Rationale**:
  - Memory: 25 × 200MB = 5GB (10% of 48GB) ✅
  - CPU: 25 sessions (25-35% of 48 vCPU) ✅
  - PostgreSQL: 25 × 2 = 50 connections (50% of 100 limit) ✅
  - Neo4j: 25 × 1 = 25 connections (50% of 50 limit) ⚠️
  - **Recommendation**: Monitor closely, may see occasional Neo4j connection issues

#### Aggressive (At Free Tier Limits):
- **Parallel Ingestion Sessions**: **30 sessions**
- **Rationale**:
  - Memory: 30 × 200MB = 6GB (12% of 48GB) ✅
  - CPU: 30 sessions (30-40% of 48 vCPU) ✅
  - PostgreSQL: 30 × 2 = 60 connections (60% of 100 limit) ✅
  - Neo4j: 30 × 1 = 30 connections (60% of 50 limit) ⚠️
  - **Recommendation**: Risky, high chance of hitting Neo4j limits

#### With Paid Databases (If Upgrading):
- **Parallel Ingestion Sessions**: **100-150 sessions**
- **Rationale**:
  - Memory: 100-150 × 200MB = 20GB-30GB (within 48GB) ✅
  - CPU: 100-150 sessions (40-60% of 48 vCPU) ✅
  - PostgreSQL: 100-150 × 2 = 200-300 connections (requires paid tier)
  - Neo4j: 100-150 × 1 = 100-150 connections (requires paid tier)
  - **Requires**: Paid PostgreSQL + Paid Neo4j (~$84/month additional)

## Implementation Recommendations

### 1. **Connection Pooling**
```python
# PostgreSQL: Use connection pooler
# Neon: Use connection pooler (port 6543)
# Limit pool size per user/service
```

### 2. **Queue System** (Recommended)
- Implement a job queue (Redis or in-memory)
- Limit concurrent ingestion to 3-5 sessions
- Queue additional requests
- Process sequentially or in small batches

### 3. **Resource Monitoring**
- Monitor PostgreSQL connection count
- Monitor Neo4j connection count
- Monitor memory usage
- Alert when approaching limits

### 4. **Graceful Degradation**
- Return 429 (Too Many Requests) when at capacity
- Provide estimated wait time
- Allow users to cancel queued jobs

## Code Implementation

### Add Queue System to Router:

```python
# In router.py
from collections import deque
from threading import Lock

# Simple in-memory queue (for free tier)
_ingestion_queue = deque()
_queue_lock = Lock()
_active_ingestions = {}  # user_id -> ingestion_task
_MAX_CONCURRENT = 5  # Conservative limit

@api_router.post("/ingest")
async def trigger_ingestion(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_user_id)
):
    # Check if user already has active ingestion
    if user_id in _active_ingestions:
        raise HTTPException(
            status_code=409,
            detail="You already have an active ingestion. Please wait for it to complete."
        )
    
    # Check if at capacity
    if len(_active_ingestions) >= _MAX_CONCURRENT:
        raise HTTPException(
            status_code=429,
            detail=f"System is at capacity ({_MAX_CONCURRENT} concurrent ingestions). Please try again in a few minutes."
        )
    
    # Start ingestion
    _active_ingestions[user_id] = True
    background_tasks.add_task(run_ingestion_sequence, repo_path, user_id)
    
    # Clean up after completion (in run_ingestion_sequence)
```

### Monitor Connections:

```python
# Add to health check
@api_router.get("/health/capacity")
def get_capacity_status():
    return {
        "active_ingestions": len(_active_ingestions),
        "max_concurrent": _MAX_CONCURRENT,
        "available_slots": _MAX_CONCURRENT - len(_active_ingestions),
        "postgres_connections": get_postgres_connection_count(),
        "neo4j_connections": get_neo4j_connection_count()
    }
```

## Expected Behavior

### Free Tier Scenarios:

#### Scenario 1: 3 Parallel Sessions ✅
- **Status**: Safe
- **PostgreSQL**: ~15 connections (well within limit)
- **Neo4j**: ~6 connections (well within limit)
- **Memory**: ~900MB (manageable)
- **Result**: No issues expected

#### Scenario 2: 5 Parallel Sessions ✅
- **Status**: Acceptable
- **PostgreSQL**: ~25 connections (within limit)
- **Neo4j**: ~10 connections (within limit)
- **Memory**: ~1.5GB (may need monitoring)
- **Result**: Should work, monitor closely

#### Scenario 3: 10 Parallel Sessions ⚠️
- **Status**: Risky
- **PostgreSQL**: ~50 connections (approaching limit)
- **Neo4j**: ~20 connections (safe)
- **Memory**: ~3GB (likely exceeds Railway free tier)
- **Result**: May hit connection limits, potential crashes

### Railway Hobby Plan ($5/month) Scenarios:

#### Scenario 1: 10 Parallel Sessions ✅
- **Status**: Safe
- **PostgreSQL**: ~50 connections (within limit)
- **Neo4j**: ~20 connections (safe)
- **Memory**: ~3GB (exceeds 2GB, but manageable with optimization)
- **Result**: Should work with memory optimization

#### Scenario 2: 15 Parallel Sessions ✅
- **Status**: Acceptable
- **PostgreSQL**: ~75 connections (approaching limit)
- **Neo4j**: ~30 connections (safe)
- **Memory**: ~4.5GB (requires memory optimization to fit in 2GB)
- **Result**: Works with optimized memory usage (~200MB per session)

#### Scenario 3: 20 Parallel Sessions ⚠️
- **Status**: Risky
- **PostgreSQL**: ~100 connections (at limit for free tier)
- **Neo4j**: ~40 connections (approaching limit)
- **Memory**: ~6GB (requires significant optimization)
- **Result**: May hit PostgreSQL connection limits, need paid PostgreSQL tier

#### Scenario 4: 25+ Parallel Sessions ⚠️
- **Status**: Requires upgrades
- **PostgreSQL**: 125+ connections (exceeds free tier → need paid tier)
- **Neo4j**: 50+ connections (at limit)
- **Memory**: 7.5GB+ (requires multiple instances or optimization)
- **Result**: Need PostgreSQL upgrade + memory optimization

## Recommendations

### For Free Tier:
1. **Limit to 3-5 concurrent ingestion sessions**
2. **Implement queue system** for additional requests
3. **Monitor resource usage** closely
4. **Return 429 errors** gracefully when at capacity
5. **Clean up old data** regularly to free storage

### For Railway Hobby Plan ($5/month):
1. **Limit to 10-15 concurrent ingestion sessions** (conservative)
2. **Optimize memory usage** per ingestion:
   - Stream processing instead of loading all data
   - Batch embeddings more efficiently
   - Clear intermediate data structures
   - Target: 150-200MB per ingestion session
3. **Upgrade PostgreSQL** to paid tier if exceeding 100 connections:
   - Neon Pro: $19/month (unlimited connections)
   - Supabase Pro: $25/month (200 connections)
4. **Use connection pooling** aggressively
5. **Monitor resource usage** with Railway metrics
6. **Implement queue system** for peak loads

### For Production (Paid Tier):
1. **Upgrade PostgreSQL** to higher connection limits
2. **Use Redis queue** for better job management
3. **Scale horizontally** with multiple backend instances
4. **Monitor with proper tools** (Datadog, New Relic, etc.)

## Memory Optimization Strategies (For Hobby Plan)

To maximize capacity on Railway Hobby Plan (2GB memory):

1. **Stream Processing**:
   ```python
   # Process files in batches instead of loading all at once
   for batch in file_batches:
       process_batch(batch)
       del batch  # Explicit cleanup
   ```

2. **Lazy Loading**:
   ```python
   # Only load what you need, when you need it
   # Use generators instead of lists
   ```

3. **Connection Reuse**:
   ```python
   # Reuse database connections instead of creating new ones
   # Use connection pooling
   ```

4. **Clear Caches**:
   ```python
   # Clear intermediate caches after processing
   self._expert_map.clear()
   self._feature_mappings.clear()
   ```

5. **Batch Embeddings**:
   ```python
   # Process embeddings in smaller batches
   # Clear accumulated data after each batch insert
   ```

## Conclusion

### Free Tier:
**Safe Capacity: 3-5 parallel ingestion sessions**

This ensures:
- ✅ No connection limit issues
- ✅ Memory stays within limits
- ✅ Stable operation
- ✅ No 429 errors
- ✅ No crashes

### Railway Hobby Plan ($5/month):
**Safe Capacity: 10-15 parallel ingestion sessions** (with optimization)

**With optimization: 15-20 parallel ingestion sessions**

This provides:
- ✅ 3-4x capacity increase over free tier
- ✅ Better CPU allocation for faster processing
- ✅ More headroom for growth
- ✅ Production-ready for small-medium scale

**Key Improvements with Hobby Plan:**
- **Memory**: 2GB (vs 512MB-1GB) → 4-8x more sessions
- **CPU**: Better allocation → faster processing
- **Stability**: More reliable for production use

**Scaling Path:**
1. **Start**: Railway Hobby ($5) + Free PostgreSQL → 10-15 sessions
2. **Scale**: Railway Hobby ($5) + Paid PostgreSQL ($19-25) → 20-25 sessions
3. **Production**: Multiple Railway instances + Paid DBs → Unlimited (with queue)

**With proper queue management, you can handle unlimited users** - they'll just wait in queue when at capacity.
