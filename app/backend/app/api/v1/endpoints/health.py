"""
Health Dashboard API endpoints
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from backend.app.core.dependencies import get_user_id
from backend.app.services.health_service import (
    HealthService,
    HealthSummary,
    CycleDetected,
    GodObject,
    OrphanNode
)

logger = logging.getLogger("dex-core")

router = APIRouter()


def _health_service_for_user(user_id: str) -> HealthService:
    from backend.app.services.ingestion_service import IngestionService
    ingestion = IngestionService(user_id=user_id)
    return HealthService(graph_engine=ingestion.graph_engine)


@router.get("/summary", response_model=HealthSummary)
def get_health_summary(user_id: str = Depends(get_user_id)):
    try:
        service = _health_service_for_user(user_id)
        return service.get_health_summary()
    except Exception as e:
        logger.error(f"Error getting health summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cycles", response_model=List[CycleDetected])
def get_circular_dependencies(user_id: str = Depends(get_user_id)):
    try:
        service = _health_service_for_user(user_id)
        return service.get_circular_dependencies()
    except Exception as e:
        logger.error(f"Error getting cycles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/risks", response_model=List[GodObject])
def get_risks(user_id: str = Depends(get_user_id)):
    try:
        service = _health_service_for_user(user_id)
        return service.get_god_objects()
    except Exception as e:
        logger.error(f"Error getting risks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orphans", response_model=List[OrphanNode])
def get_orphans(user_id: str = Depends(get_user_id)):
    try:
        service = _health_service_for_user(user_id)
        return service.get_orphan_nodes()
    except Exception as e:
        logger.error(f"Error getting orphans: {e}")
        raise HTTPException(status_code=500, detail=str(e))
