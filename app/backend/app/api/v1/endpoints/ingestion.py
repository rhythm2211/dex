from fastapi import APIRouter, BackgroundTasks
from backend.app.services.ingestion_service import IngestionService
from pydantic import BaseModel

router = APIRouter()
ingestion_service = IngestionService()

class IngestRequest(BaseModel):
    repo_path: str

@router.post("/ingest")
async def trigger_ingestion(request: IngestRequest, background_tasks: BackgroundTasks):
    # Offload heavy processing to background task
    background_tasks.add_task(ingestion_service.process_repository, request.repo_path)
    return {"status": "accepted", "message": "Ingestion pipeline started. Check logs for progress."}