# Railway Backend Service - Environment Variables

## Cleaned and Refactored Backend Variables

Copy and paste these into your **Backend Service** in Railway:

```env
# PostgreSQL Database Configuration
POSTGRES_HOST=ep-damp-dream-ahsk1hhl-pooler.c-3.us-east-1.aws.neon.tech
POSTGRES_PORT=5432
POSTGRES_USER=neondb_owner
POSTGRES_PASSWORD=npg_5YQnb0maSDlx
POSTGRES_DB=neondb
POSTGRES_VECTOR_TABLE=document_vectors

# AI API Keys
GROQ_API_KEY=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
GITHUB_TOKEN=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
OPENAI_API_KEY=

# Neo4j Graph Database Configuration
NEO4J_URI=neo4j+s://f5c2d367.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=N4jbHcSTHB8hVu5js2KHKuadLosl6Y0YpLoIZ2oSNhw
NEO4J_DATABASE=neo4j
AURA_INSTANCEID=f5c2d367
AURA_INSTANCENAME=Free instance

# Email Service (Resend) - For backend welcome emails
RESEND_API_KEY=re_XnDyFpPo_4ry9cmxkRqPf1ktg3GTGQMAN
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_FROM_NAME=DEX

# Frontend Configuration (for CORS and email links)
FRONTEND_URL=https://dex.net.in
BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in"]

# Environment Settings
ENVIRONMENT=production
DEBUG=false
```

## Variables Removed from Backend

These should **NOT** be in the backend service (they belong in frontend):

- ❌ `NEXT_PUBLIC_API_URL` - Frontend variable
- ❌ `INTERNAL_API_URL` - Frontend variable  
- ❌ `NEXTAUTH_URL` - Frontend variable
- ❌ `NEXTAUTH_SECRET` - Frontend variable
- ❌ `GITHUB_ID` - Frontend OAuth variable
- ❌ `GITHUB_SECRET` - Frontend OAuth variable
- ❌ `GOOGLE_CLIENT_ID` - Frontend OAuth variable
- ❌ `GOOGLE_CLIENT_SECRET` - Frontend OAuth variable
- ❌ `AZURE_AD_CLIENT_ID` - Frontend OAuth variable
- ❌ `AZURE_AD_CLIENT_SECRET` - Frontend OAuth variable
- ❌ `AZURE_AD_TENANT_ID` - Frontend OAuth variable

## Notes

1. **No quotes needed** - Railway handles values without quotes (unless they contain special characters)
2. **JSON arrays** - `BACKEND_CORS_ORIGINS` should be a JSON array string
3. **Empty values** - `OPENAI_API_KEY` can be empty if not using OpenAI

## How to Update in Railway

1. Go to your **Backend Service** in Railway
2. Click on **Variables** tab
3. Click **Raw Editor** (top right)
4. Delete all existing variables
5. Paste the cleaned list above
6. Click **Save**
7. Railway will automatically redeploy
