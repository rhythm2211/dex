"""
PR Review Co-pilot HTTP routes. Core logic lives in ``pr_review_core``.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException

from backend.app.core.dependencies import get_user_id
from backend.app.services.pr_review_core import (
    PRReviewRequest,
    PRReviewResponse,
    run_pr_analysis,
)

logger = logging.getLogger("dex-pr-review")

router = APIRouter()


@router.post("/analyze", response_model=PRReviewResponse)
async def analyze_pr(request: PRReviewRequest, user_id: str = Depends(get_user_id)):
    from backend.app.api.v1.router import get_ingestion_service, get_rag_service

    return await run_pr_analysis(
        user_id=user_id,
        pr_url=request.pr_url,
        changed_files=request.changed_files,
        get_ingestion_service=get_ingestion_service,
        get_rag_service=get_rag_service,
    )


@router.get("/health")
def pr_review_health():
    return {"status": "ok", "feature": "pr-review-copilot"}
