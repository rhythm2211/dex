#!/bin/bash
# Server Setup Script for DEX Deployment
# Run this on your VPS/server: bash <(curl -s https://raw.githubusercontent.com/YOUR_USERNAME/dex/main/scripts/server-setup.sh)
# Or download and run: chmod +x server-setup.sh && ./server-setup.sh

set -e

echo "🚀 DEX Server Setup Script"
echo "=========================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "❌ Please don't run as root. Use a regular user with sudo privileges."
   exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. Please log out and back in for group changes to take effect."
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo "🐳 Installing Docker Compose..."
    sudo apt install docker-compose-plugin -y
else
    echo "✅ Docker Compose already installed"
fi

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "🌐 Installing Nginx..."
    sudo apt install nginx -y
    sudo systemctl enable nginx
else
    echo "✅ Nginx already installed"
fi

# Install Certbot
if ! command -v certbot &> /dev/null; then
    echo "🔒 Installing Certbot for SSL..."
    sudo apt install certbot python3-certbot-nginx -y
else
    echo "✅ Certbot already installed"
fi

# Create deployment directory
echo "📁 Creating deployment directory..."
sudo mkdir -p /opt/dex
sudo chown $USER:$USER /opt/dex

# Set up firewall (UFW)
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw --force enable

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Log out and back in (for Docker group)"
echo "2. Clone your repository: cd /opt/dex && git clone https://github.com/YOUR_USERNAME/dex.git ."
echo "3. Update docker-compose.prod.yml with your GitHub username"
echo "4. Set up environment variables in app/.env and frontend/.env.local"
echo "5. Configure Nginx (see DEPLOYMENT_GUIDE.md)"
echo "6. Set up DNS records pointing to this server"
echo "7. Run: docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "📖 See DEPLOYMENT_GUIDE.md for detailed instructions"
