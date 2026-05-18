"""Digest triggers and notification preferences."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.dependencies import get_db, get_user_id
from backend.app.models.engineering_models import UserNotificationPrefs

router = APIRouter()


class NotificationPrefsBody(BaseModel):
    weekly_digest_enabled: bool = False
    slack_webhook_url: Optional[str] = None


@router.get("/prefs")
def get_prefs(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    row = db.query(UserNotificationPrefs).filter(UserNotificationPrefs.user_id == user_id).first()
    if not row:
        return {"weekly_digest_enabled": False, "slack_webhook_url": None}
    return {
        "weekly_digest_enabled": row.weekly_digest_enabled,
        "slack_webhook_url": row.slack_webhook_url,
    }


@router.put("/prefs")
def put_prefs(body: NotificationPrefsBody, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    row = db.query(UserNotificationPrefs).filter(UserNotificationPrefs.user_id == user_id).first()
    if not row:
        row = UserNotificationPrefs(user_id=user_id)
        db.add(row)
    row.weekly_digest_enabled = body.weekly_digest_enabled
    row.slack_webhook_url = body.slack_webhook_url
    db.commit()
    return {"status": "ok"}


@router.post("/send-now")
def send_now(user_id: str = Depends(get_user_id)):
    from backend.app.services.digest_service import send_digest_for_user

    return send_digest_for_user(user_id)
