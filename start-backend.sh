#!/bin/bash

# Script to start backend locally
cd "$(dirname "$0")/app"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Set PYTHONPATH
export PYTHONPATH="$(pwd):$PYTHONPATH"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found in app/ directory"
    echo "Please create app/.env with required configuration"
fi

echo "Starting backend on http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

# Run uvicorn
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
