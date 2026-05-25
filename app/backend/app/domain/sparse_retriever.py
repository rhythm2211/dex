"""
PostgreSQL full-text (tsvector) sparse retrieval for code and docs.
"""
from __future__ import annotations

import json
import logging
import re
from typing import List, Optional

from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.domain.retrieval_fusion import RetrievedChunk

logger = logging.getLogger("dex-core")


def _sanitize_tsquery(query: str) -> str:
    """Prepare query for plainto_tsquery — strip special chars that break FTS."""
    q = re.sub(r"[^\w\s\-_.:/]", " ", query)
    return " ".join(q.split())[:500]


def sparse_search(
    query: str,
    user_id: str,
    k: int = 20,
    file_filter: Optional[List[str]] = None,
) -> List[RetrievedChunk]:
    """
    BM25-style search via PostgreSQL ts_rank on content_tsv column.
    Falls back to ILIKE on content/file_name if FTS column missing.
    """
    q = _sanitize_tsquery(query)
    if not q.strip():
        return []

    table = settings.POSTGRES_VECTOR_TABLE
    from backend.app.models.user import engine

    results: List[RetrievedChunk] = []

    try:
        with engine.connect() as conn:
            # Try FTS first (content_tsv column from migration)
            fts_sql = text(f"""
                SELECT id, content, metadata, file_name, source,
                       ts_rank(content_tsv, plainto_tsquery('english', :q)) AS rank
                FROM {table}
                WHERE user_id = :user_id
                  AND content_tsv @@ plainto_tsquery('english', :q)
                ORDER BY rank DESC
                LIMIT :limit
            """)
            try:
                rows = conn.execute(
                    fts_sql,
                    {"q": q, "user_id": user_id, "limit": k * 2},
                ).fetchall()
            except Exception:
                conn.rollback()
                rows = []

            if not rows:
                # Fallback: ILIKE keyword match on content and file_name
                ilike_sql = text(f"""
                    SELECT id, content, metadata, file_name, source, 0.5 AS rank
                    FROM {table}
                    WHERE user_id = :user_id
                      AND (
                        content ILIKE :pat OR file_name ILIKE :pat
                        OR metadata->>'symbol_name' ILIKE :pat
                      )
                    ORDER BY length(content) ASC
                    LIMIT :limit
                """)
                pat = f"%{q.split()[0]}%" if q.split() else f"%{q}%"
                rows = conn.execute(
                    ilike_sql,
                    {"pat": pat, "user_id": user_id, "limit": k},
                ).fetchall()

            for row in rows:
                rid, content, metadata, file_name, source, rank = row[0], row[1], row[2], row[3], row[4], row[5]
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except Exception:
                        metadata = {}
                metadata = metadata or {}
                fn = file_name or source or metadata.get("file_name", "")

                if file_filter:
                    if not any(ff in fn or fn in ff for ff in file_filter):
                        continue

                results.append(
                    RetrievedChunk(
                        chunk_id=str(rid),
                        content=content or "",
                        metadata=metadata,
                        file_name=fn,
                        source="sparse",
                        raw_score=float(rank or 0),
                    )
                )
                if len(results) >= k:
                    break

    except Exception as e:
        logger.warning(f"Sparse search failed: {e}")

    return results[:k]
