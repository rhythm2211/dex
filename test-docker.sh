#!/bin/bash
# Test script for Docker setup

set -e

echo "🔍 Testing Docker Setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f "app/.env" ]; then
    echo -e "${RED}✗ .env file not found at app/.env${NC}"
    exit 1
fi
echo -e "${GREEN}✓ .env file found${NC}"

# Check Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

# Validate docker-compose.yml
echo ""
echo "📋 Validating docker-compose.yml..."
if docker-compose --env-file app/.env config > /dev/null 2>&1; then
    echo -e "${GREEN}✓ docker-compose.yml is valid${NC}"
else
    echo -e "${RED}✗ docker-compose.yml has errors${NC}"
    docker-compose --env-file app/.env config
    exit 1
fi

# Check if Dockerfiles exist
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}✗ Backend Dockerfile not found at repo root${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Backend Dockerfile exists (repo root)${NC}"

if [ ! -f "frontend/Dockerfile" ]; then
    echo -e "${RED}✗ Frontend Dockerfile not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend Dockerfile exists${NC}"

echo ""
echo -e "${YELLOW}📦 Building containers (this may take several minutes)...${NC}"
echo ""

# Build backend
echo "Building backend..."
if docker-compose --env-file app/.env build backend; then
    echo -e "${GREEN}✓ Backend built successfully${NC}"
else
    echo -e "${RED}✗ Backend build failed${NC}"
    exit 1
fi

# Build frontend
echo ""
echo "Building frontend..."
if docker-compose --env-file app/.env build frontend; then
    echo -e "${GREEN}✓ Frontend built successfully${NC}"
else
    echo -e "${RED}✗ Frontend build failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🚀 Starting containers...${NC}"
docker-compose --env-file app/.env up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Test backend health
echo ""
echo "Testing backend health endpoint..."
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
    curl -s http://localhost:8000/health | head -5
else
    echo -e "${RED}✗ Backend is not responding${NC}"
    echo "Backend logs:"
    docker-compose --env-file app/.env logs backend | tail -20
fi

# Test frontend
echo ""
echo "Testing frontend..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Frontend may still be starting (this is normal for Next.js)${NC}"
    echo "Frontend logs:"
    docker-compose --env-file app/.env logs frontend | tail -20
fi

echo ""
echo -e "${GREEN}✅ Docker setup test completed!${NC}"
echo ""
echo "Services:"
echo "  - Backend: http://localhost:8000"
echo "  - Frontend: http://localhost:3000"
echo "  - API Docs: http://localhost:8000/api/v1/docs"
echo ""
echo "To view logs: docker-compose --env-file app/.env logs -f"
echo "To stop: docker-compose --env-file app/.env down"
