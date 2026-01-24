# Quick Deployment Guide for dex.net.in

## 🎯 Your Goal
Deploy DEX to https://dex.net.in

## 📋 Quick Checklist

### Step 1: Get a Server (5 minutes)
- [ ] Sign up for DigitalOcean (recommended) or AWS/Vultr
- [ ] Create a Droplet/Instance:
  - **Size**: 4GB RAM, 2 vCPU (~$24/month)
  - **OS**: Ubuntu 22.04 LTS
  - **Region**: Choose closest to your users
- [ ] Note your server IP address

### Step 2: Set Up Server (10 minutes)
```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Run setup script (or follow manual steps in DEPLOYMENT_GUIDE.md)
bash <(curl -s https://raw.githubusercontent.com/YOUR_USERNAME/dex/main/scripts/server-setup.sh)

# Log out and back in
exit
ssh root@YOUR_SERVER_IP
```

### Step 3: Configure DNS (5 minutes)
- [ ] Go to your domain registrar (where you bought dex.net.in)
- [ ] Add DNS records:
  - **A Record**: `@` → Your server IP
  - **A Record**: `www` → Your server IP
- [ ] (Optional) Use Cloudflare for free SSL and better performance

### Step 4: Set Up Nginx & SSL (10 minutes)
```bash
# On your server
sudo nano /etc/nginx/sites-available/dex.net.in
# Copy configuration from DEPLOYMENT_GUIDE.md Step 4

sudo ln -s /etc/nginx/sites-available/dex.net.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d dex.net.in -d www.dex.net.in
```

### Step 5: Deploy Application (15 minutes)
```bash
# On your server
cd /opt/dex
git clone https://github.com/YOUR_USERNAME/dex.git .

# Update docker-compose.prod.yml with your GitHub username
nano docker-compose.prod.yml
# Replace YOUR_USERNAME with your actual GitHub username

# Create environment files
nano app/.env
# Add your configuration (see DEPLOYMENT_GUIDE.md)

nano frontend/.env.local
# Add your configuration

# Login to GitHub Container Registry
docker login ghcr.io
# Username: YOUR_GITHUB_USERNAME
# Password: YOUR_GITHUB_TOKEN (create at github.com/settings/tokens)

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### Step 6: Configure GitHub Secrets (5 minutes)
Go to GitHub → Your Repo → Settings → Secrets and variables → Actions

Add:
- `PRODUCTION_HOST`: Your server IP
- `PRODUCTION_USER`: `root` or `ubuntu`
- `PRODUCTION_SSH_KEY`: Your private SSH key
- `PRODUCTION_URL`: `https://dex.net.in`

### Step 7: Test Deployment
- [ ] Visit https://dex.net.in
- [ ] Check health: https://dex.net.in/health
- [ ] Test API: https://dex.net.in/api/v1/docs

## 🚀 Auto-Deployment

Once set up, deployments are automatic:
- Push to `main` branch → Auto-deploys to production
- Push to `dev` branch → Auto-deploys to staging (if configured)

## 📚 Full Documentation

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

## 🆘 Need Help?

1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Check Nginx: `sudo tail -f /var/log/nginx/error.log`
3. Verify DNS: `dig dex.net.in`
4. Test connectivity: `curl https://dex.net.in/health`

## ⚡ Quick Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Update and redeploy
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Stop services
docker compose -f docker-compose.prod.yml down

# Check status
docker compose -f docker-compose.prod.yml ps
```

---

**Estimated Total Time**: ~45-60 minutes
**Cost**: ~$24/month (DigitalOcean) + Domain (~$1/month)

🎉 **You're ready to deploy!**
