# DEX Deployment Checklist

Use this checklist to track your deployment progress.

## Pre-Deployment

- [ ] Domain purchased
- [ ] GitHub repository is up to date
- [ ] All environment variables documented
- [ ] API keys obtained (GROQ, Neo4j, etc.)

## Step 1: Database Setup

- [ ] PostgreSQL account created (Railway/Supabase/Neon)
- [ ] Database created
- [ ] Connection string saved
- [ ] pgvector extension installed
- [ ] Database tested (can connect)

## Step 2: Neo4j Setup

- [ ] Neo4j Aura account created
- [ ] Free database instance created
- [ ] Connection URI saved
- [ ] Username and password saved
- [ ] Connection tested

## Step 3: Frontend Deployment (Vercel)

- [ ] Vercel account created
- [ ] GitHub repository connected
- [ ] Project created (frontend folder)
- [ ] Environment variables added:
  - [ ] NEXT_PUBLIC_API_URL
  - [ ] INTERNAL_API_URL
  - [ ] NEXTAUTH_URL
  - [ ] NEXTAUTH_SECRET
  - [ ] OAuth credentials (if using)
- [ ] First deployment successful
- [ ] Vercel URL obtained (e.g., your-project.vercel.app)

## Step 4: Backend Deployment (Railway)

- [ ] Railway account created
- [ ] GitHub repository connected
- [ ] Backend service created
- [ ] Dockerfile detected/configured
- [ ] Environment variables added:
  - [ ] ENVIRONMENT=production
  - [ ] DEBUG=false
  - [ ] POSTGRES_HOST
  - [ ] POSTGRES_PORT
  - [ ] POSTGRES_USER
  - [ ] POSTGRES_PASSWORD
  - [ ] POSTGRES_DB
  - [ ] NEO4J_URI
  - [ ] NEO4J_USERNAME
  - [ ] NEO4J_PASSWORD
  - [ ] GROQ_API_KEY
  - [ ] BACKEND_CORS_ORIGINS
  - [ ] FRONTEND_URL
- [ ] First deployment successful
- [ ] Railway URL obtained (e.g., your-backend.railway.app)
- [ ] Health check passes: `/health` endpoint works

## Step 5: Domain & DNS Configuration

- [ ] Cloudflare account created (or DNS provider)
- [ ] Domain added to Cloudflare
- [ ] Nameservers updated at registrar
- [ ] DNS records added:
  - [ ] Frontend CNAME (@ → Vercel)
  - [ ] Frontend CNAME (www → Vercel)
  - [ ] Backend CNAME (api → Railway)
- [ ] SSL enabled (automatic)
- [ ] DNS propagation verified (24-48 hours)

## Step 6: Custom Domain Setup

- [ ] Frontend custom domain added in Vercel
- [ ] Backend custom domain added in Railway
- [ ] SSL certificates generated (automatic)
- [ ] Domain verified and active

## Step 7: Environment Variables Update

- [ ] Frontend env vars updated with custom domain:
  - [ ] NEXT_PUBLIC_API_URL=https://api.your-domain.com
  - [ ] NEXTAUTH_URL=https://your-domain.com
- [ ] Backend env vars updated:
  - [ ] BACKEND_CORS_ORIGINS includes your domain
  - [ ] FRONTEND_URL=https://your-domain.com
- [ ] Services redeployed with new env vars

## Step 8: Testing

- [ ] Frontend loads at https://your-domain.com
- [ ] Backend health check: https://api.your-domain.com/health
- [ ] Frontend can connect to backend
- [ ] Authentication works (if configured)
- [ ] Ingestion works (test with small repo)
- [ ] Graph visualization works
- [ ] RAG queries work

## Step 9: Database Initialization

- [ ] Connected to PostgreSQL
- [ ] pgvector extension confirmed
- [ ] Backend creates tables on first run
- [ ] Test ingestion creates data

## Step 10: Monitoring Setup

- [ ] Vercel analytics enabled
- [ ] Railway metrics checked
- [ ] Uptime monitoring set up (UptimeRobot)
- [ ] Error tracking configured (optional)

## Step 11: CI/CD (Optional)

- [ ] GitHub Actions workflows reviewed
- [ ] Deployment secrets configured (if using auto-deploy)
- [ ] Manual deployment tested
- [ ] Auto-deployment verified (push to main)

## Step 12: Security

- [ ] All secrets in environment variables (not in code)
- [ ] CORS properly configured
- [ ] HTTPS enforced everywhere
- [ ] API keys rotated (if needed)
- [ ] Database access restricted

## Step 13: Documentation

- [ ] Deployment process documented
- [ ] Environment variables documented
- [ ] Team access configured (if applicable)
- [ ] Backup procedures documented

## Post-Deployment

- [ ] Application is live and accessible
- [ ] All features tested
- [ ] Performance acceptable
- [ ] Monitoring active
- [ ] Team notified (if applicable)

## Maintenance Schedule

- [ ] Weekly: Check logs and metrics
- [ ] Monthly: Review free tier usage
- [ ] Quarterly: Update dependencies
- [ ] As needed: Database backups

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Domain:** _______________
**Frontend URL:** _______________
**Backend URL:** _______________
