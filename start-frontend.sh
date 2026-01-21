#!/bin/bash

# Script to start frontend locally
cd "$(dirname "$0")/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: .env.local file not found"
    echo "Creating .env.local with default values..."
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
EOF
    echo "✅ Created .env.local"
fi

echo "Starting frontend on http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""

# Run Next.js dev server
npm run dev
