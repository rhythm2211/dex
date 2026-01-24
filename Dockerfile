# Root Dockerfile for Railway deployment
# Build context: repository root
# Multi-stage build to reduce final image size
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY app/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --user -r /app/requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Copy only Python packages from builder
COPY --from=builder /root/.local /root/.local

# Install only runtime dependencies (git for gitpython, but not build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Copy only the backend application code
COPY app/backend/ /app/backend/

# Set Python path
ENV PYTHONPATH=/app

# Expose port (Railway will set PORT env var)
EXPOSE 8000

# Run the application - Railway sets PORT env var, use it or default to 8000
CMD sh -c "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
