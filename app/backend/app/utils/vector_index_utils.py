"""HNSW index helpers for fast bulk vector ingest (defer index during insert)."""
from __future__ import annotations

import logging
import os

logger = logging.getLogger("dex-core")


def embedding_index_name(table_name: str) -> str:
    return f"{table_name}_embedding_idx"


def defer_vector_index_enabled() -> bool:
    return os.getenv("INGEST_DEFER_VECTOR_INDEX", "true").lower() not in ("0", "false", "no")


def drop_embedding_hnsw_index(conn, table_name: str) -> None:
    """Drop HNSW index so bulk inserts avoid per-row index maintenance."""
    index_name = embedding_index_name(table_name)
    with conn.cursor() as cur:
        cur.execute(f"DROP INDEX IF EXISTS {index_name}")
    conn.commit()
    logger.info(f"Deferred vector index: dropped {index_name}")


def create_embedding_hnsw_index(conn, table_name: str) -> None:
    """Recreate HNSW index after bulk insert."""
    index_name = embedding_index_name(table_name)
    m = int(os.getenv("HNSW_M", "32"))
    ef = int(os.getenv("HNSW_EF_CONSTRUCTION", "128"))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            CREATE INDEX IF NOT EXISTS {index_name}
            ON {table_name}
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = {m}, ef_construction = {ef})
            """
        )
    conn.commit()
    logger.info(f"Deferred vector index: created {index_name} (m={m}, ef_construction={ef})")
