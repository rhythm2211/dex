# DEX Production Setup Guide

This guide provides comprehensive instructions for deploying DEX (Developer Experience) to production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Docker Deployment](#docker-deployment)
5. [Production Considerations](#production-considerations)
6. [Security Hardening](#security-hardening)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Services

- **PostgreSQL 16+** with pgvector extension
- **Neo4j** (Aura Cloud recommended for production) or self-hosted Neo4j
- **Docker & Docker Compose** (for containerized deployment)
- **Node.js 20+** and **Python 3.11+** (for manual deployment)

### Required API Keys

- **GROQ_API_KEY**: Required for LLM queries (get from [Groq](https://console.groq.com))
- **NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD**: Required for graph database
- **RESEND_API_KEY** (optional): For email notifications
- **GITHUB_TOKEN** (optional): For private repository access
- **NextAuth Secrets**: For authentication (GitHub/Google OAuth)

## Environment Configuration

### Backend Environment Variables

Create `app/.env` with the following variables:

```bash
# Environment
ENVIRONMENT=production
DEBUG=false

# PostgreSQL Configuration
POSTGRES_HOST=postgres  # Use 'postgres' in Docker, or your PostgreSQL host
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=dex
POSTGRES_VECTOR_TABLE=document_vectors

# Neo4j Configuration
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password
NEO4J_DATABASE=neo4j

# AI/LLM Configuration
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_key  # Optional, for fallback

# CORS Configuration (JSON format)
BACKEND_CORS_ORIGINS=["https://yourdomain.com","https://www.yourdomain.com"]

# Email Service (Optional)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=DEX
FRONTEND_URL=https://yourdomain.com

# GitHub Token (Optional, for private repos)
GITHUB_TOKEN=your_github_token
```

### Frontend Environment Variables

Create `frontend/.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
INTERNAL_API_URL=http://backend:8000  # Docker internal URL

# NextAuth Configuration
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_nextauth_secret_here  # Generate with: openssl rand -base64 32

# OAuth Providers (Optional)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email Service (Optional)
RESEND_API_KEY=your_resend_api_key
```

## Database Setup

### PostgreSQL with pgvector

1. **Install PostgreSQL 16+** with pgvector extension

2. **Create Database and Extension**:
```sql
CREATE DATABASE dex;
\c dex
CREATE EXTENSION vector;
```

3. **Verify pgvector Installation**:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Neo4j Setup

#### Option 1: Neo4j Aura (Recommended for Production)

1. Sign up at [Neo4j Aura](https://neo4j.com/cloud/aura/)
2. Create a new database instance
3. Copy the connection URI, username, and password
4. Add to your `app/.env` file

#### Option 2: Self-Hosted Neo4j

1. Install Neo4j following [official documentation](https://neo4j.com/docs/operations-manual/current/installation/)
2. Configure authentication
3. Update `NEO4J_URI` in `app/.env` (e.g., `bolt://localhost:7687`)

## Docker Deployment

### Quick Start

1. **Clone the repository**:
```bash
git clone <repository-url>
cd dex
```

2. **Configure environment files**:
   - Create `app/.env` (see [Backend Environment Variables](#backend-environment-variables))
   - Create `frontend/.env.local` (see [Frontend Environment Variables](#frontend-environment-variables))

3. **Build and start services**:
```bash
docker compose --env-file app/.env build
docker compose --env-file app/.env up -d
```

4. **Verify deployment**:
```bash
# Check service status
docker compose ps

# Check backend health
curl http://localhost:8001/health

# Check logs
docker compose logs -f
```

### Production Docker Compose

For production, use environment variables for sensitive data:

```bash
# Set environment variables
export POSTGRES_PASSWORD=your_secure_password
export GROQ_API_KEY=your_groq_key
export NEO4J_URI=your_neo4j_uri
# ... etc

# Start with environment variables
docker compose --env-file app/.env up -d
```

### Resource Limits

The `docker-compose.yml` includes resource limits. Adjust based on your infrastructure:

- **PostgreSQL**: 2 CPU, 2GB RAM (default)
- **Backend**: 4 CPU, 4GB RAM (default)
- **Frontend**: 2 CPU, 2GB RAM (default)

## Production Considerations

### 1. Reverse Proxy (Nginx/Traefik)

Use a reverse proxy for SSL termination and routing:

**Nginx Example**:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. SSL/TLS Certificates

- Use Let's Encrypt for free SSL certificates
- Configure automatic renewal
- Force HTTPS redirects

### 3. Database Backups

**PostgreSQL Backup**:
```bash
# Daily backup script
pg_dump -h localhost -U postgres -d dex > backup_$(date +%Y%m%d).sql
```

**Neo4j Backup** (Aura):
- Automatic backups included with Aura
- For self-hosted, use `neo4j-admin backup`

### 4. Logging

- Configure centralized logging (ELK, Loki, etc.)
- Set log levels appropriately:
  - Production: `WARNING` or `ERROR`
  - Development: `INFO` or `DEBUG`

### 5. Monitoring

- Set up health check monitoring
- Monitor database connections
- Track API response times
- Set up alerts for service failures

## Security Hardening

### 1. Environment Variables

- **Never commit** `.env` files to version control
- Use secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate API keys regularly

### 2. Database Security

- Use strong passwords
- Restrict database access to application servers only
- Enable SSL/TLS for database connections
- Regular security updates

### 3. API Security

- Implement rate limiting
- Validate all inputs
- Use HTTPS only
- Configure CORS properly (restrict to your domain)

### 4. Container Security

- Use non-root users in containers
- Scan images for vulnerabilities
- Keep base images updated
- Use minimal base images

### 5. Authentication

- Use strong NextAuth secrets
- Enable OAuth providers properly
- Implement session timeout
- Use secure cookies

## Monitoring & Health Checks

### Health Check Endpoints

- **Backend**: `GET /health`
  - Returns service status and database connectivity
  - Status codes: 200 (healthy), 503 (degraded)

- **Frontend**: Built-in Next.js health checks

### Monitoring Setup

1. **Health Check Monitoring**:
```bash
# Add to cron or monitoring service
curl -f http://localhost:8001/health || alert
```

2. **Database Monitoring**:
   - Monitor connection pool usage
   - Track query performance
   - Set up alerts for connection failures

3. **Application Monitoring**:
   - Track request rates
   - Monitor error rates
   - Set up alerts for high error rates

## Troubleshooting

### Common Issues

#### 1. Database Connection Failures

**Symptoms**: Health check shows "disconnected" for PostgreSQL/Neo4j

**Solutions**:
- Verify database credentials in `.env`
- Check network connectivity
- Verify database is running
- Check firewall rules

#### 2. CORS Errors

**Symptoms**: Frontend cannot connect to backend

**Solutions**:
- Verify `BACKEND_CORS_ORIGINS` includes your frontend URL
- Check CORS configuration in `app/backend/app/main.py`
- Ensure URLs match exactly (including protocol and port)

#### 3. Ingestion Failures

**Symptoms**: Repository ingestion fails or hangs

**Solutions**:
- Check repository URL is valid and accessible
- Verify GitHub token if using private repos
- Check disk space
- Review backend logs for specific errors

#### 4. High Memory Usage

**Symptoms**: Containers using excessive memory

**Solutions**:
- Adjust resource limits in `docker-compose.yml`
- Optimize ingestion batch sizes
- Consider scaling horizontally

### Logs

**View logs**:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

**Backend logs location**: `./app/backend/data/` (if using file logging)

## Scaling

### Horizontal Scaling

- Use load balancer for multiple backend instances
- Ensure shared database connections
- Use session storage (Redis) for stateless scaling

### Vertical Scaling

- Increase container resource limits
- Optimize database queries
- Use connection pooling

## Backup & Recovery

### Regular Backups

1. **Database Backups** (daily):
   - PostgreSQL: `pg_dump`
   - Neo4j: Aura automatic or manual backup

2. **Application Data**:
   - Backup `./app/backend/data/` directory
   - Include `repo_history.json` and other data files

### Recovery Procedure

1. Restore database from backup
2. Restore application data files
3. Restart services
4. Verify health checks

## Support

For issues and questions:
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review [architecture.md](./architecture.md)
- Check application logs

## CI/CD Integration

DEX includes comprehensive CI/CD pipelines using GitHub Actions. See [CI_CD.md](./CI_CD.md) for detailed setup instructions.

**Quick Setup:**
1. Configure GitHub Secrets (see CI_CD.md)
2. Set up deployment servers
3. Enable GitHub Container Registry
4. Push to trigger workflows

**Workflows:**
- **CI**: Automated testing and linting
- **Docker Build**: Image building and pushing
- **Deploy**: Automated deployment
- **Release**: Version management

## Next Steps

After successful deployment:
1. Set up monitoring and alerts
2. Configure automated backups
3. Configure CI/CD pipelines (see [CI_CD.md](./CI_CD.md))
4. Document your specific deployment configuration
5. Train team on operations procedures
