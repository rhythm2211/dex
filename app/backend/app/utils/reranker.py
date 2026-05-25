"""
Cross-encoder reranking for fused retrieval results.
"""
from __future__ import annotations

import logging
import os
from typing import List, Optional

from backend.app.core.config import settings
from backend.app.domain.retrieval_fusion import RetrievedChunk

logger = logging.getLogger("dex-core")

RERANK_PROVIDER = os.getenv("RERANK_PROVIDER", "none").lower()
RERANK_TOP_N = int(os.getenv("RERANK_TOP_N", "20"))
RERANK_FINAL_K = int(os.getenv("RERANK_FINAL_K", "8"))


def rerank_chunks(query: str, chunks: List[RetrievedChunk], final_k: Optional[int] = None) -> List[RetrievedChunk]:
    """Rerank top-N fused chunks; return final_k best."""
    if not chunks:
        return []
    final_k = final_k or RERANK_FINAL_K
    provider = RERANK_PROVIDER
    if provider == "none" or len(chunks) <= final_k:
        return chunks[:final_k]

    candidates = chunks[:RERANK_TOP_N]
    try:
        if provider == "cohere":
            return _cohere_rerank(query, candidates, final_k)
        if provider == "local":
            return _local_rerank(query, candidates, final_k)
    except Exception as e:
        logger.warning(f"Rerank failed ({provider}): {e}")
    return candidates[:final_k]


def _cohere_rerank(query: str, chunks: List[RetrievedChunk], final_k: int) -> List[RetrievedChunk]:
    key = (settings.COHERE_API_KEY or "").strip()
    if not key:
        logger.warning("COHERE_API_KEY missing; skipping rerank")
        return chunks[:final_k]
    import cohere

    client = cohere.ClientV2(api_key=key)
    docs = [c.content[:4000] for c in chunks]
    resp = client.rerank(
        model=os.getenv("COHERE_RERANK_MODEL", "rerank-english-v3.0"),
        query=query,
        documents=docs,
        top_n=final_k,
    )
    out: List[RetrievedChunk] = []
    for r in resp.results:
        ch = chunks[r.index]
        ch.raw_score = float(r.relevance_score)
        out.append(ch)
    return out


def _local_rerank(query: str, chunks: List[RetrievedChunk], final_k: int) -> List[RetrievedChunk]:
    from sentence_transformers import CrossEncoder

    model_name = os.getenv("LOCAL_RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
    model = CrossEncoder(model_name)
    pairs = [[query, c.content[:4000]] for c in chunks]
    scores = model.predict(pairs)
    ranked = sorted(zip(chunks, scores), key=lambda x: -float(x[1]))
    out: List[RetrievedChunk] = []
    for ch, sc in ranked[:final_k]:
        ch.raw_score = float(sc)
        out.append(ch)
    return out
