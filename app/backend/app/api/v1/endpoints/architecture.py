"""Architecture drift: re-run layer + violation scan for the ingested graph."""
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.core.dependencies import get_user_id

router = APIRouter()


@router.post("/recompute")
def recompute_architecture(
    repo_root: Optional[str] = Query(None, description="Absolute path to repo root containing dex.architecture.yaml"),
    user_id: str = Depends(get_user_id),
):
    from backend.app.api.v1.router import get_ingestion_service
    from backend.app.domain.architecture_engine import (
        apply_architecture_layers_after_ingestion,
        record_architecture_snapshot,
    )

    try:
        ingestion = get_ingestion_service(user_id)
        ge = ingestion.graph_engine
    except Exception as e:
        raise HTTPException(503, str(e)) from e

    root = (repo_root or "").strip() or getattr(ingestion, "last_ingested_repo_root", None) or ""
    if not root or not os.path.isdir(root):
        raise HTTPException(
            400,
            "Provide repo_root as a query parameter (absolute path to a checkout with dex.architecture.yaml), "
            "or run ingestion from a local folder so DEX can remember last_ingested_repo_root during the same process.",
        )

    stats = apply_architecture_layers_after_ingestion(ge, root, user_id)
    record_architecture_snapshot(user_id, int(stats.get("violations_tagged", 0)))
    return {"status": "ok", **stats}


@router.get("/health")
def arch_health():
    return {"status": "ok", "feature": "architecture-drift"}
