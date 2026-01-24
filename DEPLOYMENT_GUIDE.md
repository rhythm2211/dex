# Deployment Guide for dex.net.in

This guide will walk you through deploying DEX to your domain `dex.net.in`.

## Prerequisites

- Domain: `dex.net.in` ✅
- GitHub repository with CI/CD working ✅
- Docker images building successfully ✅

## Step 1: Choose a Hosting Provider

You need a VPS (Virtual Private Server) to host your application. Recommended options:

### Option A: DigitalOcean (Recommended for beginners)
- **Cost**: ~$12-24/month
- **Specs**: 2GB RAM, 1 vCPU minimum (4GB recommended)
- **Link**: https://www.digitalocean.com/
- **Why**: Easy setup, good documentation, predictable pricing

### Option B: AWS EC2
- **Cost**: Pay-as-you-go (~$10-20/month)
- **Specs**: t3.small or t3.medium
- **Why**: Scalable, industry standard

### Option C: Vultr / Linode / Hetzner
- **Cost**: ~$6-12/month
- **Why**: Budget-friendly options

### Option D: Railway / Render (Easier but less control)
- **Cost**: Free tier available, then ~$5-20/month
- **Why**: No server management needed

**Recommendation**: Start with DigitalOcean Droplet (4GB RAM, 2 vCPU) for ~$24/month.

---

## Step 2: Set Up Your Server

Once you have a VPS, connect via SSH and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version

# Log out and back in for group changes to take effect
```

---

## Step 3: Configure DNS Records

Go to your domain registrar (where you bought `dex.net.in`) and add these DNS records:

### If using Cloudflare (Recommended - Free SSL):
1. Sign up at https://cloudflare.com
2. Add your domain `dex.net.in`
3. Update nameservers at your registrar
4. Add DNS records:
   - **Type**: A
   - **Name**: @ (or leave blank)
   - **Content**: Your server IP address
   - **Proxy**: Enabled (orange cloud) ✅
   
   - **Type**: A
   - **Name**: www
   - **Content**: Your server IP address
   - **Proxy**: Enabled (orange cloud) ✅

### If NOT using Cloudflare:
Add these records at your registrar:
- **A Record**: `@` → Your server IP
- **A Record**: `www` → Your server IP

**Note**: DNS propagation can take 24-48 hours, but usually works within minutes.

---

## Step 4: Set Up Nginx Reverse Proxy with SSL

On your server, install Nginx and Certbot:

```bash
# Install Nginx
sudo apt install nginx -y

# Install Certbot for SSL certificates
sudo apt install certbot python3-certbot-nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/dex.net.in
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name dex.net.in www.dex.net.in;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dex.net.in www.dex.net.in;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/dex.net.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dex.net.in/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:8001/health;
        proxy_set_header Host $host;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/dex.net.in /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d dex.net.in -d www.dex.net.in

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Step 5: Set Up Deployment Directory

On your server:

```bash
# Create deployment directory
sudo mkdir -p /opt/dex
cd /opt/dex

# Clone your repository (or copy files)
git clone https://github.com/YOUR_USERNAME/dex.git .

# Or manually copy docker-compose.yml
# You'll need to copy docker-compose.yml and create .env files
```

---

## Step 6: Configure Environment Variables

Create environment files on your server:

### Backend Environment (`/opt/dex/app/.env`):

```bash
sudo nano /opt/dex/app/.env
```

```env
# Environment
ENVIRONMENT=production
DEBUG=false

# PostgreSQL (use external database or Docker service)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=dex_user
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD
POSTGRES_DB=dex

# Neo4j
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=YOUR_NEO4J_PASSWORD

# Groq API
GROQ_API_KEY=YOUR_GROQ_API_KEY

# CORS - IMPORTANT: Use your domain
BACKEND_CORS_ORIGINS=["https://dex.net.in","https://www.dex.net.in"]

# Frontend URL
FRONTEND_URL=https://dex.net.in

# Optional: Email (Resend)
RESEND_API_KEY=your_resend_key
```

### Frontend Environment (`/opt/dex/frontend/.env.local`):

```bash
sudo nano /opt/dex/frontend/.env.local
```

```env
# API URLs - Use your domain
NEXT_PUBLIC_API_URL=https://dex.net.in/api
INTERNAL_API_URL=http://backend:8000
NEXTAUTH_URL=https://dex.net.in

# NextAuth Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=YOUR_GENERATED_SECRET

# OAuth (if using)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Important**: Update `docker-compose.yml` to use your GitHub Container Registry images instead of building locally.

---

## Step 7: Update docker-compose.yml for Production

Update your `docker-compose.yml` to pull images from GitHub Container Registry:

```yaml
services:
  backend:
    image: ghcr.io/YOUR_USERNAME/dex-backend:main  # or :dev, :latest
    # Remove build section
    # build:
    #   context: ./app
    #   dockerfile: backend/Dockerfile
    container_name: dex-backend
    # ... rest of config

  frontend:
    image: ghcr.io/YOUR_USERNAME/dex-frontend:main  # or :dev, :latest
    # Remove build section
    # build:
    #   context: ./frontend
    #   dockerfile: Dockerfile
    container_name: dex-frontend
    # ... rest of config
```

---

## Step 8: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

1. **PRODUCTION_HOST**: Your server IP address (e.g., `123.45.67.89`)
2. **PRODUCTION_USER**: Your SSH username (usually `root` or `ubuntu`)
3. **PRODUCTION_SSH_KEY**: Your private SSH key (see below)
4. **PRODUCTION_URL**: `https://dex.net.in`

### Generate SSH Key for Deployment:

On your local machine:

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/github_deploy.pub user@your-server-ip

# Or manually add to server:
# ssh user@your-server-ip
# mkdir -p ~/.ssh
# nano ~/.ssh/authorized_keys
# Paste the public key content

# Copy private key to GitHub Secrets
cat ~/.ssh/github_deploy
# Copy the entire output and paste into PRODUCTION_SSH_KEY secret
```

---

## Step 9: Login to GitHub Container Registry on Server

On your server, login to pull images:

```bash
# Create GitHub Personal Access Token with read:packages permission
# Go to: https://github.com/settings/tokens

# Login to GHCR
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Or manually:
docker login ghcr.io
# Username: YOUR_GITHUB_USERNAME
# Password: YOUR_GITHUB_TOKEN (not your password!)
```

---

## Step 10: First Deployment

### Option A: Manual Deployment (Test First)

```bash
# SSH into your server
ssh user@your-server-ip

# Navigate to deployment directory
cd /opt/dex

# Pull latest images
docker compose pull

# Start services
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

### Option B: Automated Deployment via GitHub Actions

1. Push to `main` branch (triggers deployment automatically)
2. Or go to Actions → Deploy workflow → Run workflow → Select "production"

---

## Step 11: Verify Deployment

1. **Check services are running**:
   ```bash
   docker compose ps
   # All services should show "Up"
   ```

2. **Check logs**:
   ```bash
   docker compose logs backend
   docker compose logs frontend
   ```

3. **Test endpoints**:
   - Frontend: https://dex.net.in
   - Backend health: https://dex.net.in/health
   - API docs: https://dex.net.in/api/v1/docs

4. **Check SSL**:
   - Visit https://dex.net.in
   - Should show padlock icon ✅

---

## Step 12: Set Up Auto-Deployment

Your deployment workflow is already configured! It will:
- Deploy automatically when you push to `main` branch
- Pull latest Docker images
- Restart services
- Run health checks

---

## Troubleshooting

### Services won't start:
```bash
# Check logs
docker compose logs

# Check disk space
df -h

# Check Docker
docker ps
docker images
```

### Can't pull images:
```bash
# Re-login to GHCR
docker login ghcr.io

# Check image exists
docker pull ghcr.io/YOUR_USERNAME/dex-backend:main
```

### SSL certificate issues:
```bash
# Renew certificate
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

### Nginx errors:
```bash
# Test configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

---

## Security Checklist

- [ ] Firewall configured (only ports 22, 80, 443 open)
- [ ] SSH key authentication only (disable password)
- [ ] All secrets in environment variables
- [ ] Database password is strong
- [ ] SSL certificate active
- [ ] Regular backups configured
- [ ] Monitoring set up

---

## Next Steps

1. Set up monitoring (UptimeRobot, Pingdom)
2. Configure backups for PostgreSQL
3. Set up log rotation
4. Configure auto-scaling (if needed)
5. Set up CI/CD for automatic deployments

---

## Support

If you encounter issues:
1. Check logs: `docker compose logs`
2. Check Nginx: `sudo tail -f /var/log/nginx/error.log`
3. Verify DNS: `dig dex.net.in`
4. Test connectivity: `curl https://dex.net.in/health`

---

**Congratulations!** Your DEX application should now be live at https://dex.net.in 🎉
