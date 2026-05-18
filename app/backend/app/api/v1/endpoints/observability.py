"""Push production / observability signals into the graph (Sentry-style file→incident counts)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.core.dependencies import get_user_id

router = APIRouter()


class IncidentRow(BaseModel):
    file_path: str = Field(..., description="Repo-relative file path")
    count_7d: int = Field(0, ge=0)


class IncidentsPushRequest(BaseModel):
    source: str = "manual"
    incidents: List[IncidentRow]


@router.post("/incidents/push")
def push_incidents(body: IncidentsPushRequest, user_id: str = Depends(get_user_id)):
    from backend.app.api.v1.router import get_ingestion_service

    try:
        ge = get_ingestion_service(user_id).graph_engine
    except Exception as e:
        raise HTTPException(503, str(e)) from e
    if not ge.driver:
        raise HTTPException(503, "Neo4j unavailable")

    try:
        with ge.driver.session(database=ge.database) as session:
            session.run(
                """
                MERGE (i:Incident {user_id: $user_id, source: $source})
                SET i.last_seen = datetime()
                """,
                user_id=user_id,
                source=body.source[:120],
            )
            for row in body.incidents[:500]:
                fp = row.file_path.replace("\\", "/").strip()
                if not fp:
                    continue
                session.run(
                    """
                    MATCH (n:CodeNode {user_id: $user_id})
                    WHERE n.type = 'file' AND (n.id = $fp OR n.id ENDS WITH $fp)
                    SET n.prod_incidents_7d = $cnt
                    WITH n
                    MATCH (i:Incident {user_id: $user_id, source: $source})
                    MERGE (n)-[r:CAUSED_INCIDENT]->(i)
                    SET r.window = '7d', r.count = $cnt
                    """,
                    user_id=user_id,
                    fp=fp,
                    cnt=int(row.count_7d),
                    source=body.source[:120],
                )
    except Exception as e:
        raise HTTPException(500, str(e)) from e

    return {"status": "ok", "updated": len(body.incidents)}


@router.get("/health")
def obs_health():
    return {"status": "ok", "feature": "observability-incidents"}
