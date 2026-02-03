# Groq API Round-Robin Setup Guide

## Overview

This system implements automatic round-robin rotation of multiple Groq API keys to avoid 429 rate limit errors. When one key hits a rate limit, the system automatically switches to the next available key.

## Features

✅ **Round-Robin Rotation**: Distributes requests evenly across all API keys  
✅ **Automatic Retry**: On 429 errors, automatically tries the next key  
✅ **Cooldown Period**: Failed keys are temporarily skipped (60 seconds)  
✅ **Thread-Safe**: Safe for concurrent requests  
✅ **Statistics**: Track usage and errors per key  
✅ **Backward Compatible**: Still works with single `GROQ_API_KEY`

## Configuration

### Option 1: Multiple Keys (Recommended)

Set `GROQ_API_KEYS` as a comma-separated list:

```bash
GROQ_API_KEYS=gsk_key1_here,gsk_key2_here,gsk_key3_here
```

### Option 2: Single Key (Backward Compatible)

Set `GROQ_API_KEY` for a single key:

```bash
GROQ_API_KEY=gsk_your_key_here
```

**Note**: `GROQ_API_KEYS` takes precedence over `GROQ_API_KEY` if both are set.

## Railway Environment Variables

In your Railway dashboard, add:

```bash
GROQ_API_KEYS=gsk_key1,gsk_key2,gsk_key3
```

Or for a single key:

```bash
GROQ_API_KEY=gsk_your_key
```

## How It Works

1. **Initialization**: On startup, the system reads all API keys and creates a `GroqKeyManager`
2. **Round-Robin Selection**: Each request gets the next key in rotation
3. **Error Handling**: On 429 errors, the key is marked for cooldown and the next key is used
4. **Automatic Retry**: The system automatically retries with different keys up to `num_keys * 2` times
5. **Cooldown**: Failed keys are skipped for 60 seconds before being retried

## Example Usage

### With 3 API Keys:

```bash
# Environment variable
GROQ_API_KEYS=gsk_abc123,gsk_def456,gsk_ghi789
```

**Behavior:**
- Request 1 → Uses `gsk_abc123`
- Request 2 → Uses `gsk_def456`
- Request 3 → Uses `gsk_ghi789`
- Request 4 → Uses `gsk_abc123` (round-robin)
- If `gsk_abc123` hits 429 → Skips it, uses `gsk_def456` next
- After 60 seconds → `gsk_abc123` is available again

## Monitoring

### Check Key Statistics

The system tracks:
- Total requests per key
- Errors per key
- Keys currently in cooldown

You can access statistics via the `GroqKeyManager.get_stats()` method.

## Benefits

1. **No 429 Errors**: With multiple keys, rate limits are distributed
2. **Higher Throughput**: Can handle more concurrent requests
3. **Automatic Failover**: If one key fails, others continue working
4. **Load Distribution**: Even distribution across all keys

## Capacity Calculation

### Free Tier Groq Limits:
- **Rate Limit**: ~30 requests/minute per key
- **Concurrent Requests**: Limited per key

### With Multiple Keys:
- **3 Keys**: ~90 requests/minute total (3 × 30)
- **5 Keys**: ~150 requests/minute total (5 × 30)
- **10 Keys**: ~300 requests/minute total (10 × 30)

### Recommendation:
- **For 20-25 parallel ingestion sessions**: 3-5 keys should be sufficient
- **For higher throughput**: 5-10 keys recommended

## Troubleshooting

### Issue: "GroqKeyManager not initialized"

**Solution**: Ensure API keys are set in environment variables and the startup event runs successfully.

### Issue: Still getting 429 errors

**Possible Causes**:
1. All keys are rate limited (wait 60 seconds)
2. Not enough keys for the load (add more keys)
3. Keys are invalid (check key format: should start with `gsk_`)

### Issue: Keys not rotating

**Check**:
1. Verify `GROQ_API_KEYS` is set correctly (comma-separated, no spaces around commas)
2. Check logs for initialization message: "✅ GroqKeyManager initialized with X API key(s)"
3. Ensure keys are valid (test each key individually)

## Best Practices

1. **Use Multiple Keys**: Even 2-3 keys significantly reduces 429 errors
2. **Monitor Usage**: Check statistics to see which keys are used most
3. **Rotate Keys**: If a key consistently fails, replace it
4. **Balance Load**: Distribute keys evenly (don't use one key for all requests)

## Code Examples

### Manual Usage (if needed):

```python
from backend.app.utils.groq_key_manager import get_groq_manager

# Get manager
manager = get_groq_manager()

# Get LLM instance with next key
llm = manager.get_llm()

# Call with automatic retry
def my_function(llm):
    return llm.invoke("Hello")

result = manager.call_with_retry(my_function)

# Get statistics
stats = manager.get_stats()
print(f"Total requests: {stats['total_requests']}")
print(f"Keys in cooldown: {stats['keys_in_cooldown']}")
```

## Integration Points

The round-robin system is automatically used in:
1. **RAGService**: All RAG queries use round-robin
2. **HybridRetriever**: LLM calls for person extraction use round-robin
3. **All Groq API calls**: Automatically benefit from round-robin

No code changes needed - just set `GROQ_API_KEYS` environment variable!

## Conclusion

With multiple Groq API keys configured, the system will:
- ✅ Automatically rotate keys
- ✅ Handle 429 errors gracefully
- ✅ Distribute load evenly
- ✅ Provide higher throughput
- ✅ Never fail due to rate limits (as long as at least one key is available)

**Result**: No more 429 errors! 🎉
