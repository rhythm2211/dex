# Render Deployment Guide

This guide will help you deploy your DEX backend to Render using the `render.yaml` configuration file.

## Quick Start

### Option 1: Using render.yaml (Recommended)

1. **Sign up for Render**:
   - Go to https://render.com
   - Sign up with GitHub (easiest)

2. **Create New Blueprint**:
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Select your `dex` repository
   - Render will detect `render.yaml` automatically
   - Click "Apply"

3. **Set Environment Variables** (IMPORTANT):
   - After creating the service, go to "Environment" tab
   - Add the following variables manually (they're marked as `sync: false` in render.yaml):
     - `POSTGRES_HOST` - Your Supabase hostname
     - `POSTGRES_PASSWORD` - Your Supabase password
     - `GROQ_API_KEY` - Your Groq API key
     - `GITHUB_TOKEN` - Your GitHub token
     - `NEO4J_URI` - Your Neo4j URI
     - `NEO4J_PASSWORD` - Your Neo4j password
   - See `RAILWAY_ENV_VARS.md` for exact values
   - **Note**: Secrets are NOT in render.yaml for security (GitHub push protection)

4. **Review Configuration**:
   - Render will show the service configuration
   - Verify all environment variables are set
   - Click "Apply" to deploy

5. **Wait for Deployment**:
   - First deployment takes 5-10 minutes
   - Render builds the Docker image
   - Service will be available at: `https://dex-backend.onrender.com`

### Option 2: Manual Setup (Alternative)

If you prefer to set up manually:

1. **Create Web Service**:
   - Click "New +" → "Web Service"
   - Connect GitHub repository
   - Select `dex` repository

2. **Configure Service**:
   - **Name**: `dex-backend`
   - **Root Directory**: Leave blank (Dockerfile is at root)
   - **Environment**: Docker
   - **Dockerfile Path**: `Dockerfile`
   - **Docker Context**: `.`

3. **Add Environment Variables**:
   - Go to "Environment" tab
   - Add all variables from `RAILWAY_ENV_VARS.md`
   - Or copy from the `render.yaml` file above

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for build to complete

## Configuration Details

### Service Plan

- **Free Plan**: Service sleeps after 15 minutes of inactivity
  - Good for testing
  - First request after sleep takes ~30 seconds (cold start)
  - Edit `render.yaml` and change `plan: free` to `plan: starter` for always-on

- **Starter Plan** ($7/month): Always-on service
  - No cold starts
  - Better for production
  - Change in `render.yaml`: `plan: starter`

### Regions

Available regions in `render.yaml`:
- `oregon` (US West)
- `frankfurt` (Europe)
- `singapore` (Asia)

Choose the region closest to your users or Supabase database.

### Environment Variables

All required environment variables are pre-configured in `render.yaml`. 

**To update variables:**
1. Edit `render.yaml` locally
2. Commit and push to GitHub
3. Render will automatically redeploy with new variables

**Or update in Render Dashboard:**
1. Go to your service
2. Click "Environment" tab
3. Add/edit variables
4. Service will redeploy automatically

## Custom Domain Setup

1. **In Render Dashboard**:
   - Go to your service → Settings
   - Scroll to "Custom Domains"
   - Click "Add Custom Domain"
   - Enter: `api.dex.net.in`

2. **Update DNS**:
   - Render will show DNS instructions
   - Add CNAME record in your DNS provider:
     - Name: `api`
     - Value: `dex-backend.onrender.com`
   - Wait for DNS propagation (5-30 minutes)

3. **SSL Certificate**:
   - Render automatically provisions SSL
   - Wait for certificate to be issued (~5 minutes)

## Verification

After deployment, test your service:

```bash
# Health check
curl https://dex-backend.onrender.com/health

# Should return: {"status":"healthy"}
```

## Updating Frontend

Once Render is deployed:

1. **Get Render URL**:
   - From Render dashboard: `https://dex-backend.onrender.com`
   - Or custom domain: `https://api.dex.net.in`

2. **Update Vercel Environment Variables**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Update `NEXT_PUBLIC_API_URL` to your Render URL
   - Redeploy frontend

## Troubleshooting

### Service Won't Start

**Check logs**:
- Go to Render Dashboard → Your Service → Logs
- Look for error messages
- Common issues:
  - Missing environment variables
  - Docker build failures
  - Port configuration issues

### Database Connection Issues

**If you see IPv6 errors**:
- Render handles IPv4 better than Railway
- Connection pooler (port 6543) should work
- If still having issues, check Supabase network restrictions

### Cold Starts (Free Plan)

**Free plan services sleep after 15 min inactivity**:
- First request after sleep takes ~30 seconds
- Upgrade to Starter plan ($7/mo) for always-on

### Build Failures

**Common causes**:
- Dockerfile path incorrect
- Missing dependencies
- Build timeout (increase in settings)

**Fix**:
- Check build logs in Render Dashboard
- Verify Dockerfile is at repository root
- Ensure all dependencies are in `requirements.txt`

## Cost Comparison

| Plan | Cost | Always-On | Cold Starts |
|------|------|-----------|-------------|
| Free | $0 | ❌ No | ⚠️ ~30s |
| Starter | $7/mo | ✅ Yes | ✅ No |

**Recommendation**: Start with Free plan for testing, upgrade to Starter for production.

## Migration from Railway

1. **Keep Railway running** (as backup)
2. **Deploy to Render** (follow steps above)
3. **Test Render deployment** thoroughly
4. **Update frontend** to use Render URL
5. **Monitor for 24-48 hours**
6. **Pause/delete Railway** once confirmed working

## Next Steps

- ✅ Deploy to Render
- ✅ Test health endpoint
- ✅ Update frontend API URL
- ✅ Set up custom domain (optional)
- ✅ Monitor logs and performance

Need help? Check Render's documentation: https://render.com/docs
