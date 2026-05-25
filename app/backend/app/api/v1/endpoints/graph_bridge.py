"""Teaching graph bridge API — layer overview, focus search, UA-style payloads."""
import asyncio
import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.core.dependencies import get_user_id
from backend.app.domain.graph_bridge import (
    LAYER_DEFS,
    build_layer_overview,
    expand_layer,
    full_teaching_graph,
)
from backend.app.domain.subgraph_extractor import SubgraphExtractor, _empty_response
from backend.app.schemas.graph_subgraph import SubgraphRequest, SubgraphResponse
from backend.app.utils.cache import graph_cache
from backend.app.utils.rate_limiter import subgraph_limiter

logger = logging.getLogger("dex-core")

router = APIRouter()


def _get_graph_payload(user_id: str, limit: int = 2500) -> dict:
    from backend.app.api.v1.router import get_ingestion_service

    ingestion = get_ingestion_service(user_id)
    return ingestion.graph_engine.get_full_graph(limit=limit)


def _subgraph_cache_key(user_id: str, body: SubgraphRequest) -> str:
    raw = f"{body.query}|{body.depth}|{body.max_nodes}|{body.seed_k}|{body.layer}|{body.include_functions}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"graph:{user_id}:subgraph:{digest}"


def _run_subgraph_extract(user_id: str, body: SubgraphRequest) -> dict:
    from backend.app.api.v1.router import get_ingestion_service, get_rag_service

    ingestion = get_ingestion_service(user_id)
    rag = get_rag_service(user_id)
    return SubgraphExtractor(ingestion, rag).extract(body)


@router.get("/layers")
def list_layers(user_id: str = Depends(get_user_id)):
    """Architectural layer definitions for the teaching graph UI."""
    return {"layers": LAYER_DEFS}


@router.post("/subgraph", response_model=SubgraphResponse)
async def graph_subgraph(
    body: SubgraphRequest,
    user_id: str = Depends(get_user_id),
):
    """
    Focused subgraph for a natural-language query (vector seeds + Neo4j expansion).
    Primary endpoint for the Focused View dashboard.
    """
    if not subgraph_limiter.allow(user_id):
        raise HTTPException(
            status_code=429,
            detail="Subgraph rate limit reached (20/min). Please slow down.",
        )

    cache_key = _subgraph_cache_key(user_id, body)
    cached = graph_cache.get(cache_key)
    if cached is not None:
        return cached

    loop = asyncio.get_event_loop()
    try:
        with ThreadPoolExecutor() as pool:
            result = await loop.run_in_executor(pool, _run_subgraph_extract, user_id, body)
        graph_cache.set(cache_key, result, ttl=60)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"graph subgraph failed: {e}")
        return _empty_response(body.query, layer=body.layer, reason="error")


@router.get("/overview")
async def graph_overview(user_id: str = Depends(get_user_id)):
    """Collapsed layer view — only important architectural groups are shown initially."""
    cache_key = f"graph:{user_id}:bridge:overview"
    cached = graph_cache.get(cache_key)
    if cached is not None:
        return cached

    loop = asyncio.get_event_loop()

    def _build():
        raw = _get_graph_payload(user_id)
        return build_layer_overview(raw.get("nodes") or [], raw.get("links") or [])

    try:
        with ThreadPoolExecutor() as pool:
            result = await loop.run_in_executor(pool, _build)
        graph_cache.set(cache_key, result, ttl=120)
        return result
    except Exception as e:
        logger.error(f"graph bridge overview failed: {e}")
        return {"view": "overview", "nodes": [], "edges": [], "layers": []}


@router.get("/focus")
async def graph_focus(
    q: str = Query("", description="Natural language: service, path, or feature name"),
    layer: Optional[str] = Query(None, description="Restrict to layer id (api, service, data, ui, util)"),
    depth: int = Query(2, ge=1, le=4),
    max_nodes: int = Query(120, ge=10, le=300),
    seed_k: int = Query(15, ge=1, le=30),
    include_functions: bool = Query(False),
    user_id: str = Depends(get_user_id),
):
    """Focused subgraph (GET alias). Prefer POST /subgraph for NL queries."""
    if not q.strip() and not layer:
        return {
            "version": "1.0.0",
            "view": "focus",
            "query": "",
            "nodes": [],
            "edges": [],
            "matched": [],
            "meta": {"reason": "no_query"},
        }

    body = SubgraphRequest(
        query=q.strip(),
        depth=depth,
        max_nodes=max_nodes,
        seed_k=seed_k,
        layer=layer,
        include_functions=include_functions,
    )

    if not subgraph_limiter.allow(user_id):
        raise HTTPException(
            status_code=429,
            detail="Subgraph rate limit reached (20/min). Please slow down.",
        )

    cache_key = _subgraph_cache_key(user_id, body)
    cached = graph_cache.get(cache_key)
    if cached is not None:
        return cached

    loop = asyncio.get_event_loop()
    try:
        with ThreadPoolExecutor() as pool:
            result = await loop.run_in_executor(pool, _run_subgraph_extract, user_id, body)
        graph_cache.set(cache_key, result, ttl=60)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"graph bridge focus failed: {e}")
        return {
            "view": "focus",
            "nodes": [],
            "edges": [],
            "matched": [],
            "query": q,
            "meta": {"reason": "error"},
        }


@router.get("/expand-layer")
async def graph_expand_layer(
    layer_id: str = Query(..., alias="layer"),
    max_nodes: int = Query(80, ge=10, le=200),
    user_id: str = Depends(get_user_id),
):
    """Expand one architectural layer into file-level nodes."""
    cache_key = f"graph:{user_id}:bridge:layer:{layer_id}:{max_nodes}"
    cached = graph_cache.get(cache_key)
    if cached is not None:
        return cached

    loop = asyncio.get_event_loop()

    def _build():
        raw = _get_graph_payload(user_id)
        return expand_layer(
            raw.get("nodes") or [],
            raw.get("links") or [],
            layer_id,
            max_nodes=max_nodes,
        )

    try:
        with ThreadPoolExecutor() as pool:
            result = await loop.run_in_executor(pool, _build)
        graph_cache.set(cache_key, result, ttl=90)
        return result
    except Exception as e:
        logger.error(f"graph bridge expand-layer failed: {e}")
        return {"view": "focus", "nodes": [], "edges": [], "layer": layer_id}


@router.get("/full")
async def graph_full_teaching(
    limit: int = Query(400, ge=50, le=800),
    user_id: str = Depends(get_user_id),
):
    """Full codebase in teaching node format (force graph), capped for performance."""
    cache_key = f"graph:{user_id}:bridge:full:{limit}"
    cached = graph_cache.get(cache_key)
    if cached is not None:
        return cached

    loop = asyncio.get_event_loop()

    def _build():
        raw = _get_graph_payload(user_id)
        return full_teaching_graph(
            raw.get("nodes") or [],
            raw.get("links") or [],
            limit=limit,
        )

    try:
        with ThreadPoolExecutor() as pool:
            result = await loop.run_in_executor(pool, _build)
        graph_cache.set(cache_key, result, ttl=120)
        return result
    except Exception as e:
        logger.error(f"graph bridge full failed: {e}")
        return {"view": "full", "nodes": [], "edges": []}
