"""What-if a developer leaves — handoff surface from the graph."""
import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.app.core.dependencies import get_user_id

router = APIRouter()


class WhatIfRow(BaseModel):
    file: str
    bus_risk: float
    next_owners: List[str]


class WhatIfResponse(BaseModel):
    person: str
    critical_files: List[WhatIfRow]
    handoff_plan: str


@router.get("/team/what-if-leaves", response_model=WhatIfResponse)
async def what_if_leaves(
    person: str = Query(..., min_length=1, max_length=256),
    user_id: str = Depends(get_user_id),
):
    from backend.app.api.v1.router import get_ingestion_service, get_rag_service

    try:
        ingestion = get_ingestion_service(user_id)
        ge = ingestion.graph_engine
    except Exception as e:
        raise HTTPException(503, f"Graph unavailable: {e}") from e

    rows: List[WhatIfRow] = []
    if ge.driver:
        try:
            with ge.driver.session(database=ge.database) as session:
                result = session.run(
                    """
                    MATCH (n:CodeNode {user_id: $user_id})
                    WHERE n.type = 'file' AND n.top_owner = $person
                    RETURN n.id AS fid, coalesce(n.bus_risk_score,0) AS br,
                           coalesce(n.collaborators, [])[0..4] AS next_owners
                    ORDER BY br DESC
                    LIMIT 80
                    """,
                    user_id=user_id,
                    person=person.strip(),
                )
                for rec in result:
                    rows.append(
                        WhatIfRow(
                            file=rec["fid"],
                            bus_risk=float(rec["br"] or 0),
                            next_owners=[x for x in (rec["next_owners"] or []) if x and x != person][:4],
                        )
                    )
        except Exception as e:
            raise HTTPException(500, str(e)) from e

    file_summary = ", ".join(r.file for r in rows[:15])
    prompt = f"""You are an engineering manager. Developer "{person}" may leave the team.
They are top_owner on {len(rows)} files. Sample files: {file_summary}.

Write a concise 2-week handoff plan (short paragraphs, no bullets) covering: knowledge transfer, pairing, code review focus areas, and risk mitigation."""

    handoff = "Enable graph ingestion and ensure git blame data exists for a tailored handoff plan."
    try:
        rag = get_rag_service(user_id)
        loop = asyncio.get_event_loop()
        ans = await loop.run_in_executor(None, rag.answer_query, prompt)
        handoff = (ans or {}).get("answer") or handoff
    except Exception:
        pass

    return WhatIfResponse(person=person, critical_files=rows, handoff_plan=handoff[:8000])
