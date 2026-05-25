"""Fast bulk inserts into pgvector (psycopg2 + execute_values)."""

from __future__ import annotations



import json

import logging

from typing import Any, Sequence



from pgvector.psycopg2 import register_vector

from psycopg2.extras import execute_values



logger = logging.getLogger("dex-core")


def _unwrap_psycopg2_connection(conn):
    """pgvector.register_vector expects a DBAPI connection, not SQLAlchemy pool proxies."""
    for attr in ("driver_connection", "dbapi_connection"):
        dbapi = getattr(conn, attr, None)
        if dbapi is not None:
            return dbapi
    return conn


def bulk_insert_document_vectors(

    engine,

    *,

    table_name: str,

    texts: Sequence[str],

    embeddings: Sequence[Sequence[float]],

    metadatas: Sequence[dict[str, Any]],

    user_id: str,

    page_size: int = 500,

    conn=None,

) -> int:

    """Insert one embedding batch using COPY-style execute_values (much faster than per-row strings).



    If ``conn`` is provided, it is reused and not closed. Otherwise a connection is borrowed from

    ``engine`` and closed after the insert.

    """

    if not embeddings:

        return 0



    rows = []

    for text, embedding, metadata in zip(texts, embeddings, metadatas):

        meta = dict(metadata)

        meta.setdefault("user_id", user_id)

        if isinstance(text, str):
            text = text.replace("\x00", "")

        rows.append(

            (

                text,

                json.dumps(meta),

                list(embedding),

                meta.get("file_name", ""),

                meta.get("source", ""),

                meta.get("user_id", user_id),

            )

        )



    query = f"""

        INSERT INTO {table_name}

            (content, metadata, embedding, file_name, source, user_id, created_at)

        VALUES %s

    """

    template = "(%s, %s::jsonb, %s, %s, %s, %s, CURRENT_TIMESTAMP)"



    own_conn = conn is None

    if own_conn:

        conn = engine.raw_connection()

    try:

        register_vector(_unwrap_psycopg2_connection(conn))

        with conn.cursor() as cur:

            execute_values(cur, query, rows, template=template, page_size=page_size)

        conn.commit()

        return len(rows)

    finally:

        if own_conn:

            conn.close()


