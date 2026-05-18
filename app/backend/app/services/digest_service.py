"""Weekly leadership digest (email + Slack)."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from backend.app.core.config import settings
from backend.app.services.email_service import EmailService
from backend.app.services.insights_leadership_service import compute_leadership_payload
from backend.app.services.slack_service import post_slack_message

logger = logging.getLogger("dex-digest")


def _html_digest(user_id: str, payload: Dict[str, Any]) -> str:
    rows = "".join(
        f"<tr><td>{x.get('file','')}</td><td>{x.get('score',0)}</td><td>{x.get('incidents_7d',0)}</td></tr>"
        for x in (payload.get("top_risk_files") or [])[:10]
    )
    return f"""<html><body>
<h2>DEX weekly leadership digest</h2>
<p>Unowned surface: <b>{payload.get('unowned_surface_pct', 0)}%</b> |
Architecture violations (edges): <b>{payload.get('architecture_violations_this_week', 0)}</b> |
Incidents index (7d sum): <b>{payload.get('incidents_this_week', 0)}</b></p>
<h3>Top risk files</h3>
<table border="1" cellpadding="4"><tr><th>File</th><th>Score</th><th>Incidents 7d</th></tr>{rows}</table>
<p><a href="{settings.FRONTEND_URL}/insights/leadership">Open leadership dashboard</a></p>
</body></html>"""


def send_digest_for_user(user_id: str) -> Dict[str, Any]:
    """Send digest for one user if prefs allow."""
    from backend.app.api.v1.router import get_ingestion_service
    from backend.app.models.user import SessionLocal, User
    from backend.app.models.engineering_models import UserNotificationPrefs

    db = SessionLocal()
    try:
        prefs = db.query(UserNotificationPrefs).filter(UserNotificationPrefs.user_id == user_id).first()
        slack_url = (prefs.slack_webhook_url if prefs else None) or (getattr(settings, "SLACK_WEBHOOK_URL_DEFAULT", None) or "")
        email_on = bool(prefs and prefs.weekly_digest_enabled)
        user_row = db.query(User).filter(User.id == user_id).first()
        to_email = user_row.email if user_row else None
    finally:
        db.close()

    if not email_on and not slack_url:
        return {"skipped": True, "reason": "no prefs"}

    try:
        ge = get_ingestion_service(user_id).graph_engine
    except Exception as e:
        return {"error": str(e)}

    payload = compute_leadership_payload(user_id, ge)
    html = _html_digest(user_id, payload)
    summary = (
        f"Unowned {payload.get('unowned_surface_pct')}% | "
        f"Arch violations {payload.get('architecture_violations_this_week')} | "
        f"Incidents {payload.get('incidents_this_week')}"
    )

    sent = {"email": False, "slack": False}
    if email_on and to_email:
        try:
            svc = EmailService()
            if getattr(svc, "resend_enabled", False) and svc.resend_emails:
                svc.resend_emails.send(
                    {
                        "from": f"{svc.resend_from_name} <{svc.resend_from_email}>",
                        "to": [to_email],
                        "subject": "DEX — Weekly leadership digest",
                        "html": html,
                    }
                )
                sent["email"] = True
        except Exception as e:
            logger.warning(f"Digest email failed for {user_id}: {e}")

    if slack_url:
        sent["slack"] = post_slack_message(slack_url, "DEX Leadership Digest\n" + summary)

    return {"ok": True, "sent": sent}


def send_digest_all_eligible_users() -> List[str]:
    """Celery beat entry: all users with weekly_digest_enabled or default slack."""
    from backend.app.models.user import SessionLocal, User
    from backend.app.models.engineering_models import UserNotificationPrefs

    db = SessionLocal()
    try:
        prefs_rows = db.query(UserNotificationPrefs).filter(UserNotificationPrefs.weekly_digest_enabled == True).all()
        user_ids = {p.user_id for p in prefs_rows}
    finally:
        db.close()

    results = []
    for uid in user_ids:
        try:
            send_digest_for_user(uid)
            results.append(uid)
        except Exception as e:
            logger.warning(f"digest fail {uid}: {e}")
    return results
