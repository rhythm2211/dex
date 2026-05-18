"""
GitHub App / webhook receiver: PR opened/synchronize -> DEX analysis -> comment + check run.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from backend.app.core.config import settings
from backend.app.models.user import SessionLocal
from backend.app.models.engineering_models import GitHubRepoLink
from backend.app.services.github_pr_client import (
    verify_webhook_signature,
    upsert_pr_comment,
    create_check_run,
    format_pr_comment,
)
from backend.app.services.pr_review_core import run_pr_analysis

logger = logging.getLogger("dex-github-webhook")

router = APIRouter()


def _lookup_user_for_repo(owner: str, repo: str) -> Optional[tuple]:
    """Return (user_id, merge_block_critical) if repo is linked."""
    db = SessionLocal()
    try:
        row = (
            db.query(GitHubRepoLink)
            .filter(GitHubRepoLink.owner == owner, GitHubRepoLink.repo == repo)
            .first()
        )
        if row:
            return row.user_id, bool(row.merge_block_critical)
    finally:
        db.close()
    return None


async def _process_pull_request(payload: Dict[str, Any]) -> None:
    action = payload.get("action")
    if action not in ("opened", "synchronize", "reopened", "ready_for_review"):
        return

    pr = payload.get("pull_request") or {}
    repo = payload.get("repository") or {}
    full = repo.get("full_name") or ""
    if "/" not in full:
        return
    owner, name = full.split("/", 1)
    pr_number = int(pr.get("number") or 0)
    head_sha = (pr.get("head") or {}).get("sha") or ""
    html_url = pr.get("html_url") or f"https://github.com/{owner}/{name}/pull/{pr_number}"

    mapped = _lookup_user_for_repo(owner, name)
    if not mapped:
        logger.info("No DEX user linked for repo %s/%s — skipping", owner, name)
        return
    user_id, merge_block = mapped

    token = (getattr(settings, "GITHUB_TOKEN", None) or "").strip()
    if not token:
        logger.warning("GITHUB_TOKEN not set — cannot post PR comment")
        return

    try:
        from backend.app.api.v1.router import get_ingestion_service, get_rag_service

        report = await run_pr_analysis(
            user_id=user_id,
            pr_url=html_url,
            changed_files=None,
            get_ingestion_service=get_ingestion_service,
            get_rag_service=get_rag_service,
        )
        data = report.model_dump()
        body = format_pr_comment(data)
        upsert_pr_comment(owner, name, pr_number, token, body)

        conclusion = "success"
        if data.get("risk_level") == "CRITICAL" and merge_block:
            conclusion = "failure"
        elif data.get("risk_level") in ("HIGH", "CRITICAL"):
            conclusion = "neutral"

        if head_sha:
            create_check_run(
                owner,
                name,
                token,
                head_sha,
                "DEX / Engineering Intelligence",
                conclusion,
                f"Risk {data.get('risk_level')} ({data.get('overall_risk')}/100)",
                data.get("ai_summary", "")[:5000],
            )
    except Exception as e:
        logger.exception("PR webhook processing failed: %s", e)


@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
):
    body = await request.body()
    secret = (getattr(settings, "GITHUB_WEBHOOK_SECRET", None) or "").strip()
    if secret:
        if not verify_webhook_signature(secret, body, x_hub_signature_256):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = request.headers.get("X-GitHub-Event", "")
    if event == "ping":
        return {"ok": True, "msg": "pong"}

    if event == "pull_request":
        background_tasks.add_task(_process_pull_request, payload)

    return {"ok": True, "received": event}
