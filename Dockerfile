# Root Dockerfile for Railway deployment
# Build context: repository root
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from app directory (build context is root, so app/ is correct)
COPY app/requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the backend directory (build context is root, so app/backend/ is correct)
COPY app/backend/ /app/backend/

# Set Python path
ENV PYTHONPATH=/app

# Expose port (Railway will set PORT env var)
EXPOSE 8000

# Run the application - Railway sets PORT env var, use it or default to 8000
CMD sh -c "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
