"""GitHub REST helpers for PR comments and check runs (GitHub App / PAT)."""
from __future__ import annotations

import hmac
import hashlib
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("dex-github")


def verify_webhook_signature(secret: str, body: bytes, signature_header: Optional[str]) -> bool:
    if not secret or not signature_header:
        return False
    if not signature_header.startswith("sha256="):
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    expected = "sha256=" + digest
    return hmac.compare_digest(expected, signature_header)


def _headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"token {token.strip()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DEX-Engineering-Intel/1.0",
    }


def find_dex_comment_id(owner: str, repo: str, pr_number: int, token: str) -> Optional[int]:
    """Find existing bot comment containing DEX marker."""
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments"
    marker = "<!-- dex-pr-review -->"
    try:
        with httpx.Client(timeout=30.0) as client:
            page = 1
            while page <= 5:
                r = client.get(url, headers=_headers(token), params={"per_page": 100, "page": page})
                if r.status_code != 200:
                    return None
                for item in r.json():
                    if isinstance(item, dict) and marker in (item.get("body") or ""):
                        return int(item["id"])
                if len(r.json()) < 100:
                    break
                page += 1
    except Exception as e:
        logger.warning(f"find_dex_comment_id failed: {e}")
    return None


def upsert_pr_comment(owner: str, repo: str, pr_number: int, token: str, body: str) -> None:
    marker = "<!-- dex-pr-review -->"
    full_body = marker + "\n" + body
    comment_id = find_dex_comment_id(owner, repo, pr_number, token)
    try:
        with httpx.Client(timeout=30.0) as client:
            if comment_id:
                u = f"https://api.github.com/repos/{owner}/{repo}/issues/comments/{comment_id}"
                r = client.patch(u, headers=_headers(token), json={"body": full_body})
            else:
                u = f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments"
                r = client.post(u, headers=_headers(token), json={"body": full_body})
            if r.status_code not in (200, 201):
                logger.error(f"GitHub comment API failed: {r.status_code} {r.text[:500]}")
    except Exception as e:
        logger.exception(f"upsert_pr_comment failed: {e}")


def create_check_run(
    owner: str,
    repo: str,
    token: str,
    head_sha: str,
    name: str,
    conclusion: Optional[str],
    output_title: str,
    output_summary: str,
    annotations: Optional[List[Dict[str, Any]]] = None,
) -> None:
    """
    Create a check run. If conclusion is None, marks as in_progress then you must patch —
    here we use completed + neutral/failure/success in one shot for simplicity.
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/check-runs"
    status = "completed"
    conc = conclusion or "neutral"
    payload: Dict[str, Any] = {
        "name": name,
        "head_sha": head_sha,
        "status": status,
        "conclusion": conc,
        "output": {"title": output_title, "summary": output_summary},
    }
    if annotations:
        payload["output"]["annotations"] = annotations[:50]
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.post(url, headers=_headers(token), json=payload)
            if r.status_code not in (200, 201):
                logger.error(f"check-runs failed: {r.status_code} {r.text[:500]}")
    except Exception as e:
        logger.exception(f"create_check_run failed: {e}")


def format_pr_comment(report: Dict[str, Any]) -> str:
    """Markdown body for PR comment from PRReviewResponse-like dict."""
    level = report.get("risk_level", "UNKNOWN")
    risk = report.get("overall_risk", 0)
    badge = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🟠", "CRITICAL": "🔴"}.get(level, "⚪")
    lines = [
        f"## {badge} DEX PR Intelligence — **{level}** ({risk}/100)",
        "",
        "### Summary",
        report.get("ai_summary", "")[:2000],
        "",
        "### Changed files",
        ", ".join(f"`{f}`" for f in (report.get("changed_files") or [])[:15])
        + (" …" if len(report.get("changed_files") or []) > 15 else ""),
        "",
    ]
    rev = report.get("suggested_reviewers") or []
    if rev:
        lines.append("### Suggested reviewers")
        for r in rev[:5]:
            lines.append(f"- **{r.get('name')}** (confidence {r.get('confidence', 0)})")
        lines.append("")
    bus = report.get("bus_factor_regressions") or []
    if bus:
        lines.append("### Bus-factor warnings")
        for b in bus[:8]:
            lines.append(f"- `{b.get('file')}` — owner `{b.get('owner')}`, risk {b.get('bus_risk', 0):.2f}")
        lines.append("")
    circ = report.get("new_circular_deps") or []
    if circ:
        lines.append("### Circular dependencies (involving changed files)")
        for c in circ[:10]:
            lines.append(f"- `{c}`")
        lines.append("")
    arch = report.get("architecture_violations") or []
    if arch:
        lines.append("### Architecture violations")
        for a in arch[:12]:
            lines.append(f"- {a}")
        lines.append("")
    prod = report.get("prod_incident_touch") or []
    if prod:
        lines.append("### Production activity (7d)")
        for p in prod[:10]:
            lines.append(f"- `{p.get('file')}` — **{p.get('incidents_7d', 0)}** incidents")
        lines.append("")
    ci = report.get("ci_checklist") or []
    if ci:
        lines.append("### CI / review checklist")
        for item in ci[:12]:
            lines.append(f"- {item}")
        lines.append("")
    lines.append("---\n*Powered by [DEX](https://dex.net.in) engineering intelligence.*")
    return "\n".join(lines)
