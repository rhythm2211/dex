"""
Health Dashboard API endpoints
"""
import logging
from fastapi import APIRouter, HTTPException
from typing import List
from backend.app.services.health_service import (
    HealthService,
    HealthSummary,
    CycleDetected,
    GodObject,
    OrphanNode
)
from backend.app.services.ingestion_service import IngestionService

logger = logging.getLogger("dex-core")

router = APIRouter()

# Singleton service instance
_health_service = None

def get_health_service() -> HealthService:
    """Get or create HealthService instance."""
    global _health_service
    if _health_service is None:
        try:
            # Get GraphEngine from IngestionService
            ingestion_service = IngestionService()
            graph_engine = ingestion_service.graph_engine
            _health_service = HealthService(graph_engine=graph_engine)
        except Exception as e:
            logger.exception(f"Failed to initialize HealthService: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize health service: {str(e)}"
            )
    return _health_service


@router.get("/summary", response_model=HealthSummary)
def get_health_summary():
    """
    GET /api/v1/health/summary
    Returns overall health dashboard overview stats.
    """
    try:
        service = get_health_service()
        summary = service.get_health_summary()
        return summary
    except Exception as e:
        logger.error(f"Error getting health summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cycles", response_model=List[CycleDetected])
def get_circular_dependencies():
    """
    GET /api/v1/health/cycles
    Returns list of circular dependency cycles.
    """
    try:
        service = get_health_service()
        cycles = service.get_circular_dependencies()
        return cycles
    except Exception as e:
        logger.error(f"Error getting cycles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/risks", response_model=List[GodObject])
def get_risks():
    """
    GET /api/v1/health/risks
    Returns list of God Objects (high coupling files/classes).
    """
    try:
        service = get_health_service()
        god_objects = service.get_god_objects()
        return god_objects
    except Exception as e:
        logger.error(f"Error getting risks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orphans", response_model=List[OrphanNode])
def get_orphans():
    """
    GET /api/v1/health/orphans
    Returns list of orphan nodes (unused code).
    """
    try:
        service = get_health_service()
        orphans = service.get_orphan_nodes()
        return orphans
    except Exception as e:
        logger.error(f"Error getting orphans: {e}")
        raise HTTPException(status_code=500, detail=str(e))
