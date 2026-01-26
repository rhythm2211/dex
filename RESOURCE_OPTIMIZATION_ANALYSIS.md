# Resource Optimization & Concurrent User Analysis

## Current Architecture Constraints

### 1. **Neo4j Connection Pool** 🔴 CRITICAL ISSUE
**Current State:**
- Each `GraphEngine` instance creates its own Neo4j driver
- Each `IngestionService` creates its own `GraphEngine`
- Each `RAGService` creates its own `HybridRetriever` with its own Neo4j driver
- **Result**: Multiple drivers competing for the same Neo4j instance

**Impact:**
- Neo4j driver has `max_connection_pool_size=50` per driver
- If 20 users are active, that's potentially 20+ drivers × 50 connections = 1000+ connection attempts
- Neo4j Aura Free tier typically allows ~50-100 concurrent connections
- **This will cause connection exhaustion and timeouts**

**Solution:** ✅ **SHARE A SINGLE NEO4J DRIVER** (Neo4j drivers are thread-safe)

### 2. **PostgreSQL Connection Pool** 🟡 MODERATE
**Current State:**
- `pool_size=5`, `max_overflow=10` = **15 total connections**
- Each user's queries share this pool
- Vector searches and user queries compete for connections

**Impact:**
- 15 connections can handle ~10-12 concurrent active users comfortably
- Beyond that, requests will queue

**Solution:** Increase pool size based on expected load

### 3. **Groq API Rate Limits** 🟡 MODERATE
**Current State:**
- Each RAG query calls Groq API
- Free tier: ~30 RPM (requests per minute)
- Paid tier: Higher limits (check your dashboard)

**Impact:**
- If 10 users query simultaneously, that's 10 requests
- With 30 RPM limit, can handle ~3 concurrent queries per minute
- **This is a bottleneck for chatbot responses**

**Solution:** 
- Implement request queuing/throttling
- Add response caching for similar queries
- Consider upgrading Groq tier

### 4. **Embedding Generation** 🟢 GOOD
**Current State:**
- Batch processing (500 chunks at a time)
- CPU-bound operation
- Only during ingestion (not during queries)

**Impact:**
- Minimal impact on concurrent users (only during ingestion)
- Well optimized already

### 5. **Background Tasks** 🟡 MODERATE
**Current State:**
- FastAPI `BackgroundTasks` uses single-threaded executor
- Multiple ingestions run sequentially in background

**Impact:**
- Multiple users can start ingestions, but they process one at a time
- Not a blocker, but could be optimized

## Recommended Optimizations

### Priority 1: Share Neo4j Driver (CRITICAL) 🔴

**Problem:** Each user creates their own Neo4j driver
**Solution:** Create a singleton Neo4j driver manager

**Expected Impact:**
- Reduce connection pool from 20×50=1000 to 1×50=50
- Eliminate connection exhaustion
- Improve query performance

### Priority 2: Optimize PostgreSQL Pool 🟡

**Current:** 15 connections
**Recommended:** 20-30 connections (based on expected load)

**Expected Impact:**
- Support 15-20 concurrent active users
- Reduce connection wait times

### Priority 3: Implement Groq Request Throttling 🟡

**Problem:** No rate limit management for Groq API
**Solution:** Add request queue/throttle

**Expected Impact:**
- Prevent API rate limit errors
- Smooth user experience
- Better error handling

### Priority 4: Add Response Caching 🟢

**Problem:** Same queries hit Groq API repeatedly
**Solution:** Cache RAG responses for similar queries

**Expected Impact:**
- Reduce Groq API calls by 30-50%
- Faster response times
- Better user experience

## Optimal Concurrent User Limit

### Conservative Estimate (Current State)
**Without Optimizations:**
- **Neo4j**: 10-15 users (connection pool exhaustion risk)
- **PostgreSQL**: 10-12 users (connection pool limit)
- **Groq API**: 3-5 users (rate limit bottleneck)
- **Overall**: **5-8 concurrent users** (limited by Groq API)

### Optimized Estimate (After Fixes)
**With All Optimizations:**
- **Neo4j**: 30-40 users (shared driver, 50 connection pool)
- **PostgreSQL**: 20-25 users (increased pool to 30)
- **Groq API**: 10-15 users (with throttling + caching)
- **Overall**: **15-20 concurrent users** (limited by Groq API)

### Ideal Configuration
**For Best Experience:**
- **Recommended Limit**: **12-15 concurrent users**
- **Reason**: Balances all constraints while maintaining quality
- **Groq API**: With caching, can handle ~15 users comfortably
- **Response Quality**: Maintained with proper throttling

## Implementation Plan

### Step 1: Share Neo4j Driver (IMMEDIATE)
- Create singleton Neo4j driver manager
- Update GraphEngine to use shared driver
- Update HybridRetriever to use shared driver

### Step 2: Increase PostgreSQL Pool
- Update pool_size to 20, max_overflow to 15 = 35 total

### Step 3: Add Groq Throttling
- Implement request queue with rate limiting
- Add retry logic with exponential backoff

### Step 4: Add Response Caching
- Cache RAG responses (Redis or in-memory)
- Cache key: query hash + repository_id
- TTL: 1 hour

## Configuration Recommendations

```bash
# Optimal settings for 15 concurrent users
MAX_CONCURRENT_USERS=15
POSTGRES_POOL_SIZE=20
POSTGRES_MAX_OVERFLOW=15
GROQ_RATE_LIMIT_RPM=30  # Check your actual limit
ENABLE_RESPONSE_CACHE=true
CACHE_TTL_SECONDS=3600
```

## Monitoring Recommendations

1. **Neo4j Connection Pool Usage**: Monitor active connections
2. **PostgreSQL Connection Wait Time**: Track connection acquisition time
3. **Groq API Rate Limit Errors**: Monitor 429 responses
4. **Response Times**: Track P50, P95, P99 latencies
5. **Cache Hit Rate**: Monitor cache effectiveness

## Expected Performance After Optimization

- **Response Time**: < 2 seconds for cached queries, < 5 seconds for new queries
- **Concurrent Users**: 15 users without degradation
- **Uptime**: 99.9% (no connection exhaustion)
- **User Experience**: Smooth, no lagging
