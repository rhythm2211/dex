"""Ensure PostgreSQL full-text search column exists on vector table."""
from __future__ import annotations

import logging

logger = logging.getLogger("dex-core")


def ensure_content_tsv_index(conn, table_name: str) -> None:
    """
    Add generated tsvector column + GIN index for hybrid sparse retrieval.
    Safe to call repeatedly (IF NOT EXISTS).
    """
    with conn.cursor() as cur:
        cur.execute(f"""
            ALTER TABLE {table_name}
            ADD COLUMN IF NOT EXISTS content_tsv tsvector
            GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
        """)
        cur.execute(f"""
            CREATE INDEX IF NOT EXISTS {table_name}_content_tsv_idx
            ON {table_name}
            USING GIN (content_tsv);
        """)
    conn.commit()
    logger.info(f"✅ FTS column content_tsv ensured on {table_name}")
