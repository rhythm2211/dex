"""
Reciprocal Rank Fusion (RRF) for multi-channel retrieval: dense, sparse, graph.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

RetrievalSource = Literal["dense", "sparse", "graph"]

RRF_K = int(os.getenv("RRF_K", "60"))


@dataclass
class RetrievedChunk:
    chunk_id: str
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    file_name: str = ""
    source: RetrievalSource = "dense"
    rank: int = 0
    rrf_score: float = 0.0
    raw_score: float = 0.0

    @property
    def display_key(self) -> str:
        """Stable key for deduplication across channels."""
        fn = self.file_name or self.metadata.get("file_name") or self.metadata.get("source") or ""
        sym = self.metadata.get("symbol_name") or self.metadata.get("symbol_id") or ""
        if self.chunk_id and self.chunk_id != fn:
            return self.chunk_id
        if fn and sym:
            return f"{fn}::{sym}"
        return fn or self.chunk_id or self.content[:80]


def reciprocal_rank_fusion(
    ranked_lists: Dict[RetrievalSource, List[RetrievedChunk]],
    *,
    weights: Optional[Dict[RetrievalSource, float]] = None,
    k: int = RRF_K,
) -> List[RetrievedChunk]:
    """
    Merge ranked lists with weighted RRF: score(d) = sum(w / (k + rank)).
    """
    weights = weights or {"dense": 1.0, "sparse": 1.0, "graph": 0.8}
    scores: Dict[str, float] = {}
    best_chunk: Dict[str, RetrievedChunk] = {}

    for source, chunks in ranked_lists.items():
        w = weights.get(source, 1.0)
        for rank, chunk in enumerate(chunks, start=1):
            key = chunk.display_key
            scores[key] = scores.get(key, 0.0) + w / (k + rank)
            if key not in best_chunk or chunk.content:
                prev = best_chunk.get(key)
                if prev is None or len(chunk.content) > len(prev.content):
                    best_chunk[key] = chunk

    fused: List[RetrievedChunk] = []
    for key, score in sorted(scores.items(), key=lambda x: -x[1]):
        ch = best_chunk[key]
        fused.append(
            RetrievedChunk(
                chunk_id=ch.chunk_id,
                content=ch.content,
                metadata=dict(ch.metadata),
                file_name=ch.file_name,
                source=ch.source,
                rrf_score=round(score, 6),
                raw_score=ch.raw_score,
            )
        )
    for i, ch in enumerate(fused):
        ch.rank = i + 1
    return fused


def chunks_to_context_string(chunks: List[RetrievedChunk], max_chars: int = 120_000) -> str:
    """Format fused chunks for LLM prompt."""
    parts: List[str] = []
    total = 0
    for ch in chunks:
        fn = ch.file_name or ch.metadata.get("file_name", "unknown")
        header = f"--- SNIPPET ({fn}) [rrf={ch.rrf_score:.4f}, src={ch.source}] ---"
        block = f"{header}\n{ch.content}"
        if total + len(block) > max_chars:
            break
        parts.append(block)
        total += len(block)
    return "\n\n".join(parts) if parts else "No relevant code snippets found in vector database."
