# Supabase IPv4 Add-on Management

This directory contains scripts to manage the IPv4 add-on for your Supabase project. The IPv4 add-on is required to connect to Supabase from containerized environments (like Docker) that may have IPv6 connectivity issues.

## Quick Start

### On Windows (PowerShell)

```powershell
# Check current status
.\scripts\manage-supabase-ipv4.ps1 status

# Enable IPv4 add-on
.\scripts\manage-supabase-ipv4.ps1 enable

# Disable IPv4 add-on (if needed)
.\scripts\manage-supabase-ipv4.ps1 disable
```

### On Linux/Mac (Bash)

```bash
# Check current status
./scripts/manage-supabase-ipv4.sh status

# Enable IPv4 add-on
./scripts/manage-supabase-ipv4.sh enable

# Disable IPv4 add-on (if needed)
./scripts/manage-supabase-ipv4.sh disable
```

## Configuration

The scripts are pre-configured with:
- **Access Token**: `sbp_dda610bf0a8e5fe2782b093b069919719edbddc4`
- **Project Ref**: `zyrxhllgdgowsbjislaq` (extracted from your database hostname)

## Why Enable IPv4 Add-on?

**Important**: You may not need the IPv4 add-on! 

### Option 1: Use Connection Pooler (Recommended - No Add-on Needed)
The **Shared Connection Pooler** (port 6543) resolves to IPv4 addresses automatically and does **NOT** require the IPv4 add-on. This is the recommended approach for containerized deployments.

**To use the pooler**, simply change your `POSTGRES_PORT` to `6543` in your `.env` file:
```bash
POSTGRES_PORT=6543  # Connection pooler - no IPv4 add-on needed
```

### Option 2: Enable IPv4 Add-on (Only if Using Direct Connection)
If you need to use **direct connections** (port 5432), you may encounter errors like:
```
connection to server at "db.xxxxx.supabase.co" (2406:da1a:...), port 5432 failed: Network is unreachable
```

This happens because:
1. Docker containers may resolve hostnames to IPv6 addresses
2. Direct connections require IPv6 support or the IPv4 add-on
3. The IPv4 add-on provides a dedicated IPv4 endpoint for direct connections

**Note**: The IPv4 add-on is only needed for direct connections (port 5432). If you use the connection pooler (port 6543), you don't need it.

## After Enabling IPv4 (if using direct connections)

Once the IPv4 add-on is enabled:
1. Direct connections (port 5432) will work reliably
2. The IPv4 resolution in `config.py` will help ensure connections use IPv4
3. You can continue using direct connections instead of the pooler

## Troubleshooting

### Check if IPv4 is enabled
```powershell
.\scripts\manage-supabase-ipv4.ps1 status
```

### If you get authentication errors
- Verify your access token is valid at https://supabase.com/dashboard/account/tokens
- Make sure the token has the correct permissions

### If the script doesn't work
- Check your internet connection
- Verify the project ref matches your Supabase project
- Check Supabase API status

## Manual API Calls

If you prefer to use curl directly:

```bash
# Set variables
export SUPABASE_ACCESS_TOKEN="sbp_dda610bf0a8e5fe2782b093b069919719edbddc4"
export PROJECT_REF="zyrxhllgdgowsbjislaq"

# Check status
curl -X GET "https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

# Enable IPv4
curl -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"addon_type": "ipv4"}'

# Disable IPv4
curl -X DELETE "https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons/ipv4" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```
