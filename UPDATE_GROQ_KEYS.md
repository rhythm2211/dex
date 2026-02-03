# Update Groq API Keys

## Instructions

Add or update the following line in your `app/.env` file:

```bash
GROQ_API_KEYS="gsk_your_key_here,gsk_your_key_here,gsk_your_key_here"
```

## For Railway Deployment

In your Railway dashboard, add or update the environment variable:

**Variable Name:** `GROQ_API_KEYS`

**Variable Value:**
```
gsk_your_key_here,gsk_your_key_here,gsk_your_key_here
```

(No quotes needed in Railway)

## Verification

After updating, restart your backend service. You should see in the logs:

```
✅ GroqKeyManager initialized with 3 API key(s)
```

## Notes

- The keys are comma-separated (no spaces around commas)
- All 3 keys will be used in round-robin rotation
- This will prevent 429 rate limit errors
- With 3 keys, you can handle ~90 requests/minute (3 × 30)
