"""
Legacy ingestion stub.

Live, authenticated ingestion is implemented on ``api_router`` in
``router.py`` (``POST /api/v1/ingest``). This router is not mounted in
``main.py``; it remains safe to import without instantiating services without
``user_id``.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class IngestRequest(BaseModel):
    repo_path: str


@router.post("/ingest")
async def trigger_ingestion(_request: IngestRequest):
    raise HTTPException(
        status_code=410,
        detail="This router is not in use. Use POST /api/v1/ingest with authentication (X-User-ID).",
    )
