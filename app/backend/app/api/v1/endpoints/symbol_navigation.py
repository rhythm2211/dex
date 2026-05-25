"""
Go-to-definition and find-references API (SCIP + graph-backed).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from backend.app.core.config import settings
from backend.app.core.dependencies import get_user_id
from backend.app.utils.connection_utils import create_neo4j_driver, resolve_neo4j_database

logger = logging.getLogger("dex-core")
router = APIRouter()


class SymbolLocation(BaseModel):
    node_id: str
    name: str
    file_path: str
    line: Optional[int] = None
    scip_symbol_id: Optional[str] = None


class SymbolReferencesResponse(BaseModel):
    symbol: str
    definition: Optional[SymbolLocation] = None
    references: List[SymbolLocation] = []


def _get_driver():
    uri = settings.NEO4J_URI
    user = settings.NEO4J_USERNAME
    password = settings.NEO4J_PASSWORD
    if not uri or not user or not password:
        raise HTTPException(status_code=503, detail="Neo4j not configured")
    db = resolve_neo4j_database(uri, settings.NEO4J_DATABASE)
    driver = create_neo4j_driver(uri, user, password, database=db)
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection failed")
    return driver, db


@router.get("/symbol/{symbol_id:path}/definition", response_model=SymbolLocation)
def get_definition(symbol_id: str, user_id: str = Depends(get_user_id)):
    """Resolve symbol to its definition node."""
    driver, db = _get_driver()
    try:
        with driver.session(database=db) as session:
            result = session.run(
                """
                MATCH (n:CodeNode {user_id: $user_id})
                WHERE n.id = $sym OR n.name = $sym OR n.scip_symbol_id = $sym
                   OR n.id ENDS WITH ('::' + $sym)
                RETURN n.id AS id, n.name AS name, n.file_path AS fp,
                       n.start_line AS line, n.scip_symbol_id AS scip
                ORDER BY CASE WHEN n.type = 'function' THEN 0 ELSE 1 END
                LIMIT 1
                """,
                user_id=user_id,
                sym=symbol_id,
            )
            rec = result.single()
            if not rec:
                raise HTTPException(status_code=404, detail="Symbol not found")
            fp = rec["fp"] or (rec["id"].split("::")[0] if rec["id"] else "")
            return SymbolLocation(
                node_id=rec["id"],
                name=rec["name"] or rec["id"],
                file_path=fp,
                line=rec["line"],
                scip_symbol_id=rec["scip"],
            )
    finally:
        driver.close()


@router.get("/symbol/{symbol_id:path}/references", response_model=SymbolReferencesResponse)
def get_references(
    symbol_id: str,
    user_id: str = Depends(get_user_id),
    limit: int = Query(50, le=200),
):
    """Find references to a symbol via REFERENCES, CALLS, or IMPORTS edges."""
    driver, db = _get_driver()
    refs: List[SymbolLocation] = []
    definition: Optional[SymbolLocation] = None
    try:
        with driver.session(database=db) as session:
            def_rec = session.run(
                """
                MATCH (n:CodeNode {user_id: $user_id})
                WHERE n.id = $sym OR n.name = $sym OR n.scip_symbol_id = $sym
                RETURN n LIMIT 1
                """,
                user_id=user_id,
                sym=symbol_id,
            ).single()
            if not def_rec:
                raise HTTPException(status_code=404, detail="Symbol not found")
            n = def_rec["n"]
            nid = n.get("id")
            definition = SymbolLocation(
                node_id=nid,
                name=n.get("name", nid),
                file_path=n.get("file_path") or (nid.split("::")[0] if nid else ""),
                line=n.get("start_line"),
                scip_symbol_id=n.get("scip_symbol_id"),
            )

            result = session.run(
                """
                MATCH (src:CodeNode {user_id: $user_id})-[r:REFERENCES|CALLS|IMPORTS]->(tgt:CodeNode {user_id: $user_id})
                WHERE tgt.id = $nid OR tgt.scip_symbol_id = $scip OR tgt.name = $name
                RETURN src.id AS id, src.name AS name, src.file_path AS fp,
                       src.start_line AS line, src.scip_symbol_id AS scip, type(r) AS rel
                LIMIT $limit
                """,
                user_id=user_id,
                nid=nid,
                scip=n.get("scip_symbol_id"),
                name=n.get("name"),
                limit=limit,
            )
            for rec in result:
                fp = rec["fp"] or (rec["id"].split("::")[0] if rec["id"] else "")
                refs.append(
                    SymbolLocation(
                        node_id=rec["id"],
                        name=rec["name"] or rec["id"],
                        file_path=fp,
                        line=rec["line"],
                        scip_symbol_id=rec["scip"],
                    )
                )
    finally:
        driver.close()

    return SymbolReferencesResponse(
        symbol=symbol_id,
        definition=definition,
        references=refs,
    )
