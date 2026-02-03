# Free Tier Capacity Analysis (Railway Hobby + Free Databases)

## Current Architecture

- **Railway Hobby Plan**: 48GB RAM / 48 vCPU ✅ (NOT a bottleneck)
- **Neon PostgreSQL Free Tier**: 100 concurrent connections ⚠️ (PRIMARY BOTTLENECK)
- **Neo4j Aura Free Tier**: ~50 concurrent connections ⚠️ (SECONDARY BOTTLENECK)

## Connection Usage Analysis

### PostgreSQL Connections Per Ingestion Session

**Current Implementation:**
- Connection pool: 20 base + 40 overflow = 60 connections (shared across all sessions)
- Each ingestion session uses connections from the pool
- **Key Insight**: With connection pooling, we don't need 5 connections per session!

**Optimized Approach:**
- Use shared connection pool (60 connections)
- Each session borrows connections as needed, returns immediately
- **Actual usage**: ~1-2 connections per active session (not 5!)
- **Why**: Connection pooling allows sharing - sessions don't hold connections when idle

### Neo4j Connections Per Ingestion Session

**Current Implementation:**
- Neo4j pool: 50 connections (default)
- Each session: ~1-2 connections when actively writing
- **Actual usage**: ~1 connection per active session (pooled)

## Realistic Capacity Calculation

### PostgreSQL Constraint (100 connections free tier)

**With Connection Pooling:**
- Pool size: 60 connections (20 base + 40 overflow)
- Each active session: ~1-2 connections (when actively inserting)
- **Capacity**: 30-50 parallel sessions (using 60-100 connections)
- **Conservative**: 20-30 sessions (using 40-60 connections, leaving headroom)

### Neo4j Constraint (50 connections free tier)

**With Connection Pooling:**
- Pool size: 30-40 connections (leaving 10-20 headroom)
- Each active session: ~1 connection (when actively writing)
- **Capacity**: 30-40 parallel sessions
- **Conservative**: 20-25 sessions (leaving headroom)

### Combined Constraint

**The limiting factor is the SMALLER of the two:**
- PostgreSQL: 20-30 sessions (conservative)
- Neo4j: 20-25 sessions (conservative)
- **Result**: **20-25 parallel sessions** (limited by Neo4j)

## Recommended Configuration

### Conservative (Safe for Free Tier):
```bash
MAX_CONCURRENT_INGESTIONS=20
POSTGRES_POOL_SIZE=15
POSTGRES_MAX_OVERFLOW=25  # Total: 40 connections (leaves 60 headroom)
NEO4J_POOL_SIZE=30  # Leaves 20 headroom
```

**Capacity**: 20 parallel sessions
- PostgreSQL: 20 × 2 = 40 connections (well within 100 limit)
- Neo4j: 20 × 1 = 20 connections (well within 50 limit)
- Memory: 20 × 200MB = 4GB (well within 48GB)
- CPU: 20 sessions (well within 48 vCPU)

### Moderate (Pushing Free Tier Limits):
```bash
MAX_CONCURRENT_INGESTIONS=25
POSTGRES_POOL_SIZE=20
POSTGRES_MAX_OVERFLOW=30  # Total: 50 connections
NEO4J_POOL_SIZE=35  # Leaves 15 headroom
```

**Capacity**: 25 parallel sessions
- PostgreSQL: 25 × 2 = 50 connections (within 100 limit)
- Neo4j: 25 × 1 = 25 connections (within 50 limit, but tight)
- **Risk**: Approaching Neo4j limit, may see occasional connection errors

### Aggressive (At Free Tier Limits):
```bash
MAX_CONCURRENT_INGESTIONS=30
POSTGRES_POOL_SIZE=20
POSTGRES_MAX_OVERFLOW=40  # Total: 60 connections
NEO4J_POOL_SIZE=40  # Very tight, leaves only 10 headroom
```

**Capacity**: 30 parallel sessions
- PostgreSQL: 30 × 2 = 60 connections (within 100 limit)
- Neo4j: 30 × 1 = 30 connections (within 50 limit, but risky)
- **Risk**: High chance of hitting Neo4j connection limits, 429 errors

## Optimization Strategies

### 1. Minimize Connection Hold Time
- ✅ **Already implemented**: Connection pooling with immediate return
- ✅ **Already implemented**: Batch operations to reduce connection time
- **Impact**: Allows more sessions with fewer connections

### 2. Optimize Neo4j Connection Usage
- Use smaller Neo4j pool (30-35 instead of 50)
- Batch Neo4j writes to reduce connection time
- **Impact**: Can support 20-25 sessions safely

### 3. Queue System for Overflow
- When at capacity (20-25 sessions), queue additional requests
- Process queue as sessions complete
- **Impact**: Better user experience, no 429 errors

### 4. Connection Monitoring
- Track active connections in real-time
- Reject new sessions if approaching limits
- **Impact**: Prevents crashes, graceful degradation

## Expected Performance

### With 20 Parallel Sessions:
- **Throughput**: 20 repositories processed simultaneously
- **Memory**: ~4GB (8% of 48GB available)
- **CPU**: ~20-30% utilization (plenty of headroom)
- **PostgreSQL**: 40 connections (40% of limit)
- **Neo4j**: 20 connections (40% of limit)
- **Status**: ✅ Safe, stable, plenty of headroom

### With 25 Parallel Sessions:
- **Throughput**: 25 repositories processed simultaneously
- **Memory**: ~5GB (10% of 48GB available)
- **CPU**: ~25-35% utilization
- **PostgreSQL**: 50 connections (50% of limit)
- **Neo4j**: 25 connections (50% of limit)
- **Status**: ✅ Acceptable, monitor closely

### With 30 Parallel Sessions:
- **Throughput**: 30 repositories processed simultaneously
- **Memory**: ~6GB (12% of 48GB available)
- **CPU**: ~30-40% utilization
- **PostgreSQL**: 60 connections (60% of limit)
- **Neo4j**: 30 connections (60% of limit)
- **Status**: ⚠️ Risky, may hit Neo4j limits

## Storage Considerations

### PostgreSQL Free Tier (0.5GB):
- Each repository: ~10-50MB vectors
- **Capacity**: 10-50 repositories total
- **Recommendation**: Clean up old data regularly

### Neo4j Free Tier (1GB):
- Each repository: ~5-20MB graph data
- **Capacity**: 50-200 repositories
- **Recommendation**: Usually not a bottleneck

## Recommendations

### For Production (Free Tier Databases):

1. **Start Conservative**: Set `MAX_CONCURRENT_INGESTIONS=20`
   - Safe, stable, plenty of headroom
   - Good user experience

2. **Monitor and Adjust**: Use `/api/v1/health/capacity` endpoint
   - Watch connection counts
   - Watch for 429 errors
   - Gradually increase if stable

3. **Implement Queue System**: 
   - Queue requests when at capacity
   - Process queue as sessions complete
   - Better UX than 429 errors

4. **Optimize Connection Usage**:
   - Already done: Connection pooling
   - Already done: Batch operations
   - Consider: Smaller batch sizes for faster connection release

5. **Storage Management**:
   - Monitor PostgreSQL storage (0.5GB limit)
   - Clean up old user data
   - Consider data retention policies

## When to Upgrade Databases

### Upgrade PostgreSQL When:
- Consistently using 80+ connections (80% of limit)
- Need more than 30 parallel sessions
- Storage approaching 0.5GB limit

### Upgrade Neo4j When:
- Consistently using 40+ connections (80% of limit)
- Need more than 25 parallel sessions
- Storage approaching 1GB limit

## Cost-Benefit Analysis

### Current Setup (Free Tier):
- **Railway Hobby**: $5/month
- **Neon PostgreSQL**: Free
- **Neo4j Aura**: Free
- **Total**: $5/month
- **Capacity**: 20-25 parallel sessions
- **ROI**: Excellent for free tier

### With Paid Databases:
- **Railway Hobby**: $5/month
- **Neon Pro**: $19/month (unlimited connections)
- **Neo4j Aura Professional**: ~$65/month (200+ connections)
- **Total**: ~$89/month
- **Capacity**: 100-150+ parallel sessions
- **ROI**: Good for production scale

## Conclusion

**With Railway Hobby Plan + Free Tier Databases:**
- **Realistic Capacity**: **20-25 parallel ingestion sessions**
- **Bottleneck**: Neo4j connection limit (50 connections)
- **Recommendation**: Start with 20, monitor, adjust up to 25
- **Railway Resources**: NOT a bottleneck (only using 8-12% of available resources)

The system is well-optimized for free tier constraints. Railway Hobby Plan provides massive headroom, but free tier databases limit us to 20-25 sessions. This is still excellent for a free tier setup!
