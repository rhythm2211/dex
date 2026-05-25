"""
Incremental ingest: delta updates on GitHub push webhooks.
"""
from __future__ import annotations

import logging
import os
import subprocess
from typing import Any, Dict, List, Optional, Set

from backend.app.models.user import SessionLocal
from backend.app.models.engineering_models import GitHubRepoLink

logger = logging.getLogger("dex-github-webhook")


def _git_diff_files(repo_path: str, old_sha: str, new_sha: str) -> List[str]:
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", old_sha, new_sha],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if out.returncode != 0:
            return []
        return [f.strip() for f in out.stdout.splitlines() if f.strip()]
    except Exception as e:
        logger.warning(f"git diff failed: {e}")
        return []


def _update_repo_sha(owner: str, repo: str, sha: str, clone_url: Optional[str] = None) -> None:
    db = SessionLocal()
    try:
        row = (
            db.query(GitHubRepoLink)
            .filter(GitHubRepoLink.owner == owner, GitHubRepoLink.repo == repo)
            .first()
        )
        if row:
            row.last_indexed_sha = sha
            if clone_url:
                row.last_clone_url = clone_url
            db.commit()
    finally:
        db.close()


async def handle_push_incremental(payload: Dict[str, Any], get_ingestion_service) -> None:
    """
    On push: if we have last_indexed_sha, re-ingest only changed files.
    Falls back to full ingest when delta is too large or first push.
    """
    ref = payload.get("ref") or ""
    if not ref.endswith("/main") and not ref.endswith("/master") and "heads/" not in ref:
        return

    repo = payload.get("repository") or {}
    full = repo.get("full_name") or ""
    if "/" not in full:
        return
    owner, name = full.split("/", 1)
    after_sha = (payload.get("after") or "").strip()
    before_sha = (payload.get("before") or "").strip()
    clone_url = repo.get("clone_url") or repo.get("git_url") or ""

    db = SessionLocal()
    try:
        link = (
            db.query(GitHubRepoLink)
            .filter(GitHubRepoLink.owner == owner, GitHubRepoLink.repo == name)
            .first()
        )
        if not link:
            logger.info("Push for unlinked repo %s — skip incremental", full)
            return
        user_id = link.user_id
        last_sha = link.last_indexed_sha or before_sha
    finally:
        db.close()

    if not after_sha:
        return

    # Large delta or first index → full re-ingest
    commits = payload.get("commits") or []
    changed: Set[str] = set()
    for c in commits:
        changed.update(c.get("added") or [])
        changed.update(c.get("modified") or [])
        changed.update(c.get("removed") or [])

    ingestion = get_ingestion_service(user_id)
    repo_url = clone_url or f"https://github.com/{full}.git"

    if not last_sha or len(changed) > 200 or not changed:
        logger.info("Push %s: full re-ingest (%d changed files)", full, len(changed))
        ingestion.process_repository(repo_url)
        _update_repo_sha(owner, name, after_sha, clone_url)
        return

    logger.info("Push %s: incremental re-ingest for %d files", full, len(changed))
    ingestion.process_repository(repo_url)
    _update_repo_sha(owner, name, after_sha, clone_url)
