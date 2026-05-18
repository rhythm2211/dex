"""
Celery app for scheduled tasks (weekly leadership digest).

Run worker:  celery -A backend.celery_app worker --loglevel=info
Run beat:    celery -A backend.celery_app beat --loglevel=info
"""
import os

from celery import Celery
from celery.schedules import crontab

_redis = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery = Celery("dex", broker=_redis, backend=_redis)


@celery.task(name="dex.weekly_leadership_digest")
def weekly_leadership_digest():
    from backend.app.services.digest_service import send_digest_all_eligible_users

    return {"users": send_digest_all_eligible_users()}


celery.conf.beat_schedule = {
    "weekly-dex-leadership-digest": {
        "task": "dex.weekly_leadership_digest",
        "schedule": crontab(hour=9, minute=0, day_of_week="mon"),
    },
}

celery.conf.timezone = "UTC"
