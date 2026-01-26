# Multi-User Concurrency Analysis

## Executive Summary

**Current Status: ⚠️ NOT READY for Multiple Concurrent Users**

Your application has several critical issues that will cause problems when multiple users test simultaneously. The system is designed as a **single-user application** with shared global state.

---

## Critical Issues

### 1. **Singleton Services (CRITICAL)**
**Location:** `app/backend/app/api/v1/router.py`

**Problem:**
- `IngestionService` and `RAGService` are **global singletons** (lines 27-28)
- All users share the **same service instance**
- Only **one ingestion can run at a time** (line 345-346 checks if state is "running")

**What Happens:**
- User A starts ingesting repo1 → Status becomes "running"
- User B tries to ingest repo2 → Gets HTTP 409 error: "An ingestion task is already running"
- User B must wait until User A finishes (could be 5-30 minutes)

**Impact:** 🔴 **BLOCKING** - Only one user can ingest at a time

---

### 2. **Shared Graph Data (CRITICAL)**
**Location:** `app/backend/app/services/ingestion_service.py`, `app/backend/app/domain/graph_engine.py`

**Problem:**
- All users read/write to the **same Neo4j database**
- Graph data is **not isolated by user**
- When User A ingests repo1, User B will see repo1's graph

**What Happens:**
- User A ingests `github.com/userA/repo1`
- User B ingests `github.com/userB/repo2`
- User B's ingestion **overwrites** User A's graph data
- Both users end up seeing User B's repository graph

**Impact:** 🔴 **DATA CORRUPTION** - Users see wrong repositories

---

### 3. **Shared File System State (HIGH)**
**Location:** `app/backend/app/services/ingestion_service.py` (line 145)

**Problem:**
- All users write to the same files:
  - `data/repo_history.json` - Git commit history
  - `data/repo_graph.json` - Graph data (if still used)
- No user isolation in file paths

**What Happens:**
- User A's ingestion writes to `data/repo_history.json`
- User B's ingestion **overwrites** the same file
- Last writer wins - previous user's data is lost

**Impact:** 🔴 **DATA LOSS** - File conflicts between users

---

### 4. **Database Connection Pool (MODERATE)**
**Location:** `app/backend/app/models/user.py` (lines 65-78)

**Current Configuration:**
```python
pool_size=5
max_overflow=10
```

**Analysis:**
- ✅ **GOOD**: Connection pooling is configured
- ✅ **GOOD**: Can handle up to 15 concurrent database connections
- ⚠️ **RISK**: If more than 15 users hit the database simultaneously, requests will queue

**Impact:** 🟡 **MODERATE** - Should handle 10-15 concurrent users, but may bottleneck under heavy load

---

### 5. **Session Management (GOOD)**
**Location:** `frontend/src/app/api/auth/[...nextauth]/route.ts`

**Analysis:**
- ✅ **GOOD**: NextAuth.js handles sessions per user correctly
- ✅ **GOOD**: Each user has isolated authentication state
- ✅ **GOOD**: User profiles stored separately in PostgreSQL

**Impact:** ✅ **NO ISSUE** - Authentication works correctly for multiple users

---

### 6. **Vector Database (MODERATE)**
**Location:** PostgreSQL + pgvector

**Problem:**
- All users write to the same `document_vectors` table
- No user/repository isolation in vector storage
- When User A ingests repo1, vectors are stored globally
- When User B ingests repo2, vectors **overwrite** User A's vectors (via `_wipe_knowledge_base()`)

**What Happens:**
- User A queries about repo1 → Gets correct results
- User B ingests repo2 → Wipes User A's vectors
- User A queries again → Gets wrong results (from repo2)

**Impact:** 🔴 **DATA CORRUPTION** - Vector search returns wrong results

---

## What Will Happen During Multi-User Testing

### Scenario 1: Two Users Testing Simultaneously

1. **User A** logs in → ✅ Works fine
2. **User B** logs in → ✅ Works fine
3. **User A** starts ingestion → ✅ Starts successfully
4. **User B** tries to start ingestion → ❌ **HTTP 409 Error**: "An ingestion task is already running"
5. **User A** finishes ingestion → ✅ Sees their graph
6. **User B** starts ingestion → ✅ Starts (User A's graph is wiped)
7. **User A** queries → ❌ Gets **User B's repository** results
8. **User B** queries → ✅ Gets correct results

### Scenario 2: Three Users Testing

1. All three users log in → ✅ Works
2. User A starts ingestion → ✅ Works
3. User B tries to start → ❌ **Blocked** (HTTP 409)
4. User C tries to start → ❌ **Blocked** (HTTP 409)
5. User A finishes → User B can start
6. User B finishes → User C can start
7. **Result**: Users must queue sequentially, cannot work in parallel

---

## Recommendations

### Short-Term Fixes (Quick Wins)

1. **Add User Context to Ingestion**
   - Pass `user_id` to ingestion endpoints
   - Store user_id in ingestion status
   - Allow multiple ingestions if different users

2. **User-Scoped Graph Storage**
   - Add `user_id` or `repository_id` to Neo4j nodes
   - Filter graph queries by user/repository
   - Store multiple graphs simultaneously

3. **User-Scoped File Storage**
   - Use `data/{user_id}/repo_history.json` instead of `data/repo_history.json`
   - Isolate file storage per user

4. **User-Scoped Vector Storage**
   - Add `user_id` or `repository_id` metadata to vectors
   - Filter vector searches by user/repository
   - Don't wipe all vectors, only user-specific ones

### Long-Term Architecture Changes

1. **Multi-Tenant Architecture**
   - Each user has isolated data namespace
   - Repository-based isolation (multiple repos per user)
   - Proper data cleanup and lifecycle management

2. **Service Instance Per Request/User**
   - Instead of singleton, create service instances per user context
   - Use dependency injection with user context
   - Allow parallel processing

3. **Queue System**
   - Use Celery or similar for background tasks
   - Support multiple concurrent ingestions
   - Track job status per user

4. **Database Schema Changes**
   - Add `user_id` to all relevant tables
   - Add `repository_id` for multi-repo support
   - Proper indexing for user-scoped queries

---

## Testing Recommendations

Before allowing multiple users to test:

1. ✅ **Test with 2 users** - Verify blocking behavior
2. ✅ **Test data isolation** - Ensure users don't see each other's data
3. ✅ **Test concurrent queries** - Verify RAG queries work with multiple users
4. ✅ **Monitor database connections** - Check connection pool usage
5. ✅ **Test ingestion queue** - Verify sequential processing

---

## Current Capacity Estimate

**Safe Concurrent Users:** 1-2 users (if they don't ingest simultaneously)
**Maximum Concurrent Users:** 10-15 users (for read-only operations)
**Critical Limitation:** Only 1 ingestion can run at a time

---

## Conclusion

Your application **will work** for multiple logged-in users for **read-only operations** (viewing graphs, querying), but will **fail** if:
- Multiple users try to ingest repositories simultaneously
- Users expect to see their own repository data
- Users need isolated workspaces

**Recommendation:** Implement user-scoped data isolation before allowing multiple users to test ingestion features.
