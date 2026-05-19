# DEX backend API — canonical production image
# Build context: repository root
#
#   docker build -t dex-backend:local -f Dockerfile .
#
# Railway: railway.json (buildContext: ".", dockerfilePath: Dockerfile)

# -----------------------------------------------------------------------------
# Stage 1: builder — compile/install Python deps (CPU-only PyTorch)
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY app/requirements-prod.txt /build/requirements.txt

# CPU-only PyTorch first (avoids ~3GB CUDA libs from default PyPI torch)
RUN pip install --no-cache-dir --user \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.10.0+cpu

RUN pip install --no-cache-dir --user -r /build/requirements.txt

# -----------------------------------------------------------------------------
# Stage 2: runtime — minimal image, non-root
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove \
    && groupadd --gid 1000 dex \
    && useradd --uid 1000 --gid 1000 --create-home --shell /usr/sbin/nologin dex

COPY --from=builder --chown=dex:dex /root/.local /home/dex/.local
COPY --chown=dex:dex app/backend/ /app/backend/

RUN mkdir -p /app/backend/data /home/dex/.cache/huggingface /home/dex/.cache/torch \
    && chown -R dex:dex /app/backend/data /home/dex/.cache

ENV PATH=/home/dex/.local/bin:$PATH \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/home/dex/.cache/huggingface \
    TRANSFORMERS_CACHE=/home/dex/.cache/huggingface \
    TORCH_HOME=/home/dex/.cache/torch

USER dex

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"]

# Railway sets PORT (e.g. 8080); default 8000 for local compose
CMD ["sh", "-c", "exec python -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
