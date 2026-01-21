# Connection Reset Error - Root Cause Analysis & Fixes

## Problem Summary
The application was experiencing "Connection reset by peer" errors when connecting to external services (Neo4j, Pinecone, GitHub, etc.). These errors occurred due to:

1. **No connection retry logic** - Transient network failures caused immediate failures
2. **No connection timeout configuration** - Connections could hang indefinitely
3. **No connection pooling** - New connections created for each operation
4. **No connection health checks** - Dead connections not detected
5. **Poor error handling** - Connection errors not properly caught and handled

## Root Causes Identified

### 1. Neo4j Connections
- **Issue**: Driver created without timeout or retry configuration
- **Impact**: Connection resets during long-running queries or network hiccups
- **Location**: `app/backend/app/domain/graph_engine.py`, `app/backend/app/domain/hybrid_retriever.py`

### 2. Git Clone Operations
- **Issue**: No retry logic for transient network failures
- **Impact**: Repository cloning failed on first network error
- **Location**: `app/backend/app/services/ingestion_service.py`

### 3. Pinecone API Calls
- **Issue**: No retry logic for connection resets during vector indexing
- **Impact**: Batch indexing operations failed on network errors
- **Location**: `app/backend/app/services/ingestion_service.py`

### 4. Groq API Calls
- **Issue**: No timeout or retry configuration
- **Impact**: LLM queries could hang or fail on network issues
- **Location**: `app/backend/app/services/rag_service.py`

## Solutions Implemented

### 1. Connection Utility Module (`app/backend/app/utils/connection_utils.py`)
Created a centralized utility for connection management:

- **`retry_on_connection_error` decorator**: Automatically retries operations on connection errors
  - Configurable retry count (default: 3)
  - Exponential backoff (1s, 2s, 4s delays)
  - Catches ConnectionError, OSError, ServiceUnavailable, TransientError

- **`create_neo4j_driver` function**: Creates Neo4j drivers with proper configuration
  - Connection timeout: 30 seconds
  - Connection pool size: 50
  - Connection lifetime: 1 hour
  - Connection acquisition timeout: 60 seconds
  - Automatic connection verification

- **`verify_neo4j_connection` function**: Health check for Neo4j connections

### 2. Neo4j Connection Improvements

**Before:**
```python
self.driver = GraphDatabase.driver(uri, auth=(user, password))
```

**After:**
```python
from backend.app.utils.connection_utils import create_neo4j_driver
self.driver = create_neo4j_driver(uri, user, password)
```

**Benefits:**
- Proper timeout configuration
- Connection pooling
- Automatic retry on connection errors
- Connection health verification

### 3. Git Clone Retry Logic

**Added:**
- Specific error detection for "Connection reset" and "Connection aborted"
- Better error messages explaining possible causes
- ConnectionError and OSError exception handling
- Clear user-facing error messages

### 4. Pinecone Retry Logic

**Added:**
- Automatic retry on connection reset errors
- Retry once before failing
- Better error logging
- Graceful degradation

### 5. Session Management

**Added:**
- `_safe_session_run` method with retry wrapper
- Connection verification before queries
- Proper exception handling
- Automatic reconnection on connection loss

## How It Prevents Future Errors

### 1. Automatic Retry
- Transient network failures are automatically retried
- Exponential backoff prevents overwhelming the service
- Maximum retry limit prevents infinite loops

### 2. Connection Pooling
- Reuses existing connections instead of creating new ones
- Reduces connection overhead
- Better resource management

### 3. Timeout Configuration
- Connections timeout after reasonable periods
- Prevents hanging operations
- Frees resources quickly

### 4. Health Checks
- Verifies connections before use
- Detects dead connections early
- Triggers reconnection automatically

### 5. Better Error Handling
- Specific error messages for different failure types
- Actionable error messages for users
- Detailed logging for debugging

## Testing Recommendations

1. **Network Interruption Test**: Simulate network drops during operations
2. **Timeout Test**: Test behavior with slow/unresponsive services
3. **Retry Test**: Verify retry logic works correctly
4. **Connection Pool Test**: Verify connection reuse
5. **Health Check Test**: Verify dead connection detection

## Monitoring

Watch for these log messages:
- `"connection reset (attempt X/Y). Retrying..."`
- `"Neo4j connection lost, attempting to reconnect..."`
- `"Pinecone connection reset during batch X, retrying..."`

These indicate the retry logic is working.

## Configuration

Connection settings can be adjusted in `connection_utils.py`:
- `max_retries`: Number of retry attempts (default: 3)
- `delay`: Initial retry delay in seconds (default: 1.0)
- `backoff`: Delay multiplier (default: 2.0)
- Neo4j timeouts: Adjustable in `create_neo4j_driver()`

## Future Improvements

1. **Circuit Breaker Pattern**: Stop retrying if service is consistently down
2. **Metrics Collection**: Track connection success/failure rates
3. **Adaptive Retry**: Adjust retry strategy based on error patterns
4. **Connection Monitoring**: Proactive connection health monitoring
5. **Rate Limiting**: Prevent overwhelming services with retries
