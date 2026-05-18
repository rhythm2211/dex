"""Leadership dashboard API."""
from fastapi import APIRouter, Depends, HTTPException

from backend.app.core.dependencies import get_user_id

router = APIRouter()


@router.get("/leadership")
def get_leadership_insights(user_id: str = Depends(get_user_id)):
    from backend.app.api.v1.router import get_ingestion_service
    from backend.app.services.insights_leadership_service import compute_leadership_payload

    try:
        ingestion = get_ingestion_service(user_id)
        ge = ingestion.graph_engine
    except Exception as e:
        raise HTTPException(503, f"Graph unavailable: {e}") from e

    return compute_leadership_payload(user_id, ge)
