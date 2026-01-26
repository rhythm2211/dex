# Groq Multi-Key Setup Guide

This system allows you to use multiple Groq API keys to avoid rate limiting, token exhaustion, and provide automatic failover.

## Features

✅ **Load Balancing**: Distributes requests across multiple keys  
✅ **Automatic Failover**: If one key fails, automatically uses another  
✅ **Rate Limit Management**: Tracks RPM and TPM per key  
✅ **Token Exhaustion Prevention**: Rotates keys to prevent quota exhaustion  
✅ **Health Monitoring**: Track key status and usage statistics  
✅ **Zero Configuration**: Works automatically once keys are set  

## Setup

### Environment Variables

Set your Groq API keys in one of two ways:

#### Option 1: Multiple Keys (Recommended)
```bash
# Comma-separated or space-separated
GROQ_API_KEYS="key1,key2,key3"
# OR
GROQ_API_KEYS="key1 key2 key3"
```

#### Option 2: Single Key (Backward Compatible)
```bash
GROQ_API_KEY="your_single_key"
```

### Optional: Per-Key Rate Limits

If your keys have different rate limits, you can configure them individually:

```bash
# Default limits (applied to all keys if not specified)
GROQ_RPM_LIMIT=30      # Requests per minute
GROQ_TPM_LIMIT=30000   # Tokens per minute

# Per-key limits (optional)
GROQ_KEY_0_RPM=30      # First key RPM limit
GROQ_KEY_0_TPM=30000   # First key TPM limit
GROQ_KEY_1_RPM=60      # Second key RPM limit (if different tier)
GROQ_KEY_1_TPM=60000   # Second key TPM limit
```

## How It Works

1. **Key Selection**: The system uses round-robin load balancing to distribute requests
2. **Availability Check**: Before each request, checks if a key has capacity (RPM/TPM)
3. **Automatic Retry**: If a key fails, automatically tries the next available key
4. **Status Tracking**: Tracks key status (active, rate_limited, failed, exhausted)
5. **Cooldown Period**: Failed keys enter a cooldown period before being retried

## Usage

The system is **automatic** - no code changes needed! The `MultiKeyChatGroq` wrapper handles everything:

```python
from backend.app.utils.groq_client import MultiKeyChatGroq

# Create client (automatically uses all configured keys)
llm = MultiKeyChatGroq(
    model_name="llama-3.3-70b-versatile",
    temperature=0
)

# Use it like normal ChatGroq
response = llm.invoke("Your prompt here")
```

## Monitoring

### Check Key Status via API

```bash
GET /api/v1/health/groq-keys
```

Returns:
```json
{
  "total_keys": 3,
  "active_keys": 2,
  "rate_limited_keys": 1,
  "failed_keys": 0,
  "exhausted_keys": 0,
  "keys": [
    {
      "index": 0,
      "status": "active",
      "rpm_used": 15,
      "rpm_limit": 30,
      "tpm_used": 15000,
      "tpm_limit": 30000,
      "rpm_remaining": 15,
      "tpm_remaining": 15000,
      "total_requests": 150,
      "total_tokens": 450000,
      "failure_count": 0,
      "last_success": 1706284800.0,
      "last_failure": null
    },
    ...
  ]
}
```

### Key Statuses

- **active**: Key is working normally
- **rate_limited**: Key hit rate limit (429 error)
- **failed**: Key failed multiple times (enters cooldown)
- **exhausted**: Key quota exhausted

## Benefits

### Before (Single Key)
- ❌ Rate limited at 30 RPM
- ❌ Token exhaustion causes failures
- ❌ No failover if key fails
- ❌ Manual monitoring required

### After (Multi-Key)
- ✅ 3 keys = 90 RPM capacity (3 × 30)
- ✅ Automatic key rotation prevents exhaustion
- ✅ Automatic failover on errors
- ✅ Built-in health monitoring

## Example Scenarios

### Scenario 1: High Traffic
```bash
# 3 keys with 30 RPM each = 90 RPM total capacity
GROQ_API_KEYS="key1,key2,key3"
```

### Scenario 2: Mixed Tiers
```bash
# 1 free tier key (30 RPM) + 1 paid tier key (60 RPM) = 90 RPM total
GROQ_API_KEYS="free_key,paid_key"
GROQ_KEY_0_RPM=30
GROQ_KEY_1_RPM=60
```

### Scenario 3: Redundancy
```bash
# 2 keys for redundancy - if one fails, other takes over
GROQ_API_KEYS="primary_key,backup_key"
```

## Troubleshooting

### No Keys Available
If you see "No available Groq API keys":
1. Check that `GROQ_API_KEYS` or `GROQ_API_KEY` is set
2. Check key status via `/api/v1/health/groq-keys`
3. Verify keys are valid and not exhausted

### Keys Stuck in Failed State
Keys automatically recover after the cooldown period (60 seconds by default). To manually reset:

```python
from backend.app.utils.groq_key_manager import groq_key_manager
groq_key_manager.reset_key("your_key_here")
```

### Rate Limits Still Hit
- Add more keys to increase total capacity
- Check individual key limits via status endpoint
- Verify keys are from different accounts/tiers

## Migration from Single Key

If you're currently using `GROQ_API_KEY`:

1. **No code changes needed** - system is backward compatible
2. **Add more keys**: Set `GROQ_API_KEYS="old_key,new_key1,new_key2"`
3. **Remove old variable** (optional): System will use `GROQ_API_KEYS` if set

## Technical Details

- **Thread-safe**: Uses locks for concurrent access
- **Singleton pattern**: One manager instance across the app
- **Automatic cleanup**: Removes old rate limit tracking data
- **Smart retry**: Only retries on transient errors (rate limits, network issues)
