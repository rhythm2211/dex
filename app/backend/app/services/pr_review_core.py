"""
Shared PR analysis logic for REST API and GitHub App webhooks.
"""
from __future__ import annotations

import re
import json
import logging
import asyncio
from typing import Optional, List, Dict, Any, Tuple, Callable, Awaitable

from fastapi import HTTPException
from pydantic import BaseModel, field_validator

from backend.app.core.config import settings

logger = logging.getLogger("dex-pr-review")


class PRReviewRequest(BaseModel):
    pr_url: Optional[str] = None
    repo_url: Optional[str] = None
    base_branch: Optional[str] = "main"
    head_branch: Optional[str] = None
    changed_files: Optional[List[str]] = None

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v):
        if v is None:
            return None
        raw = str(v).strip()
        if not raw:
            return None
        u = raw.replace("://www.github.com", "://github.com")
        if u.startswith("http://github.com"):
            u = "https://" + u[len("http://") :]
        if not re.match(r"https://github\.com/[^/]+/[^/]+/pull/\d+", u):
            raise ValueError(
                "pr_url must look like https://github.com/owner/repo/pull/123 (http and www are accepted)"
            )
        return u


class FileRisk(BaseModel):
    file: str
    risk_score: int
    owner: str
    bus_risk: float
    collaborators: List[str]
    downstream_count: int
    is_new_circular_dep: bool


class PRReviewResponse(BaseModel):
    pr_url: Optional[str]
    overall_risk: int
    risk_level: str
    changed_files: List[str]
    file_risks: List[FileRisk]
    blast_files: List[str]
    new_circular_deps: List[str]
    bus_factor_regressions: List[Dict[str, Any]]
    suggested_reviewers: List[Dict[str, Any]]
    ci_checklist: List[str]
    ai_summary: str
    ownership_changes: List[Dict[str, Any]]
    architecture_violations: List[str] = []
    prod_incident_touch: List[Dict[str, Any]] = []


def _parse_github_pr(pr_url: str) -> Tuple[str, str, int]:
    m = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", pr_url)
    if not m:
        raise ValueError(f"Cannot parse GitHub PR URL: {pr_url!r}")
    return m.group(1), m.group(2), int(m.group(3))


def _github_api_message(resp) -> str:
    try:
        data = resp.json()
        if isinstance(data, dict) and data.get("message"):
            return str(data["message"])
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return (resp.text or "")[:280].strip()


async def _fetch_github_pr_files(owner: str, repo: str, pr_number: int) -> List[str]:
    import httpx

    api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DEX-PRReview/1.0 (+https://github.com/github/rest-api-description)",
    }
    token = (getattr(settings, "GITHUB_TOKEN", None) or "").strip()
    if token:
        headers["Authorization"] = f"token {token}"

    all_files: List[str] = []
    page = 1

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        while True:
            resp = await client.get(
                api_url,
                headers=headers,
                params={"per_page": 100, "page": page},
            )

            if resp.status_code == 404:
                hint = ""
                if not token:
                    hint = " For private repositories, configure GITHUB_TOKEN in the backend .env."
                raise HTTPException(
                    404,
                    "PR not found, or the repository is private and no valid GITHUB_TOKEN is configured." + hint,
                )

            if resp.status_code == 403:
                msg = _github_api_message(resp) or "Forbidden by GitHub (rate limit or token scope)."
                raise HTTPException(403, f"GitHub API refused access: {msg}")

            if resp.status_code == 401:
                gh_msg = _github_api_message(resp) or "Bad credentials"
                if token:
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            "GitHub rejected GITHUB_TOKEN (401). Remove the line from app/.env to use "
                            "unauthenticated access for public PRs, or set a new PAT (classic: repo scope; "
                            "fine-grained: Contents read on the target repo). No quotes or 'Bearer ' prefix. "
                            f"GitHub: {gh_msg}"
                        ),
                    )
                raise HTTPException(status_code=502, detail=f"GitHub API unauthorized (401): {gh_msg}")

            if resp.status_code != 200:
                msg = _github_api_message(resp) or f"HTTP {resp.status_code}"
                raise HTTPException(502, f"GitHub API error ({resp.status_code}): {msg}")

            try:
                data = resp.json()
            except json.JSONDecodeError as e:
                raise HTTPException(502, f"GitHub returned non-JSON for PR files (page {page}): {e}") from e

            if not isinstance(data, list):
                raise HTTPException(502, f"Unexpected GitHub response (expected list of files): {type(data).__name__}")

            for item in data:
                if not isinstance(item, dict):
                    continue
                name = item.get("filename")
                if isinstance(name, str) and name.strip():
                    all_files.append(name.strip())

            if len(data) < 100:
                break
            page += 1
            if page > 50:
                logger.warning("PR file list truncated at 5000 files (GitHub pagination cap).")
                break

    return all_files


def _compute_file_risk(file_path: str, graph_engine, user_id: str) -> FileRisk:
    try:
        blast = graph_engine.get_blast_radius(file_path)
        risk_score = int(blast.get("total_risk_score", 0))
        downstream = [n for n in blast.get("nodes", []) if n.get("impactType") != "source"]
    except Exception as e:
        logger.warning(f"Blast radius failed for {file_path}: {e}")
        blast = {}
        risk_score = 0
        downstream = []

    owner = "Unknown"
    bus_risk = 0.0
    collaborators: List[str] = []
    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            result = session.run(
                """
                MATCH (n:CodeNode {user_id: $user_id})
                WHERE n.id = $file_id OR n.id ENDS WITH $file_id OR $file_id ENDS WITH n.id
                RETURN n.top_owner AS owner, n.bus_risk_score AS bus_risk,
                       n.collaborators AS collaborators
                LIMIT 1
                """,
                user_id=user_id,
                file_id=file_path,
            )
            rec = result.single()
            if rec:
                owner = rec["owner"] or "Unknown"
                bus_risk = float(rec["bus_risk"] or 0)
                collaborators = list(rec["collaborators"] or [])
    except Exception as e:
        logger.debug(f"Ownership lookup failed for {file_path}: {e}")

    return FileRisk(
        file=file_path,
        risk_score=risk_score,
        owner=owner,
        bus_risk=bus_risk,
        collaborators=collaborators,
        downstream_count=len(downstream),
        is_new_circular_dep=False,
    )


def _detect_circular_deps(changed_files: List[str], graph_engine, user_id: str) -> List[str]:
    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            result = session.run(
                """
                MATCH path = (a:CodeNode {user_id: $user_id})-[:DEPENDS_ON|IMPORTS*2..6]->(a)
                WITH nodes(path) AS cycle_nodes
                UNWIND cycle_nodes AS n
                WHERE n.id IN $files
                RETURN DISTINCT n.id AS file_id
                """,
                user_id=user_id,
                files=changed_files,
            )
            return [r["file_id"] for r in result]
    except Exception as e:
        logger.warning(f"Circular dep detection failed: {e}")
        return []


def _collect_blast_union(changed_files: List[str], graph_engine, user_id: str) -> List[str]:
    affected: set = set()
    for f in changed_files[:20]:
        try:
            blast = graph_engine.get_blast_radius(f)
            for n in blast.get("nodes", []):
                if n.get("impactType") != "source":
                    affected.add(n.get("id", n.get("data", {}).get("label", "")))
        except Exception:
            pass
    return sorted(affected)


def _suggest_reviewers(file_risks: List[FileRisk], graph_engine, user_id: str) -> List[Dict[str, Any]]:
    expert_scores: Dict[str, float] = {}
    try:
        node_ids = [fr.file for fr in file_risks]
        with graph_engine.driver.session(database=graph_engine.database) as session:
            result = session.run(
                """
                MATCH (p:Person)-[r:EXPERT_ON]->(f:CodeNode {user_id: $user_id})
                WHERE f.id IN $files
                RETURN p.name AS name, sum(r.weight) AS total_weight
                ORDER BY total_weight DESC
                LIMIT 8
                """,
                user_id=user_id,
                files=node_ids,
            )
            for rec in result:
                expert_scores[rec["name"]] = float(rec["total_weight"] or 0)
    except Exception as e:
        logger.debug(f"Reviewer suggestion failed: {e}")
        for fr in file_risks:
            if fr.owner and fr.owner != "Unknown":
                expert_scores[fr.owner] = expert_scores.get(fr.owner, 0) + fr.risk_score

    return [
        {"name": name, "confidence": round(min(score / 100, 1.0), 2)}
        for name, score in sorted(expert_scores.items(), key=lambda x: -x[1])[:5]
    ]


def _build_ci_checklist(file_risks: List[FileRisk], blast_files: List[str]) -> List[str]:
    checklist = []
    test_files = [f for f in blast_files if "test" in f.lower() or "spec" in f.lower()]
    for tf in test_files[:10]:
        checklist.append(f"Run: {tf}")
    high_risk = [fr for fr in file_risks if fr.risk_score >= 70]
    if high_risk:
        checklist.append(f"Manual review required for {len(high_risk)} high-risk file(s)")
    cyclic = [fr for fr in file_risks if fr.is_new_circular_dep]
    if cyclic:
        checklist.append(f"Resolve {len(cyclic)} circular dependency/ies before merge")
    regressions = [fr for fr in file_risks if fr.bus_risk >= 0.7]
    if regressions:
        checklist.append(f"Bus factor warning: {len(regressions)} file(s) with single-owner risk")
    if not checklist:
        checklist.append("No critical checks required — standard review process")
    return checklist


async def _generate_ai_summary(
    pr_url: Optional[str],
    changed_files: List[str],
    file_risks: List[FileRisk],
    overall_risk: int,
    rag_service,
    extra_notes: str = "",
) -> str:
    high_risk_files = [fr.file for fr in file_risks if fr.risk_score >= 60]
    circular = [fr.file for fr in file_risks if fr.is_new_circular_dep]

    prompt = f"""You are a senior software engineer reviewing a pull request.

PR: {pr_url or 'Direct analysis'}
Changed files ({len(changed_files)}): {', '.join(changed_files[:10])}{'...' if len(changed_files) > 10 else ''}
Overall risk score: {overall_risk}/100
High-risk files: {', '.join(high_risk_files[:5]) or 'none'}
Circular dependencies introduced: {', '.join(circular) or 'none'}
{extra_notes}

Write a concise PR review summary (3-4 sentences) covering:
1. What this PR likely changes based on the file names
2. The main risk areas and why
3. What reviewers should focus on
4. Whether you recommend approval, changes, or blocking

Be direct and actionable. No bullet points."""

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, rag_service.answer_query, prompt)
        return result.get("answer", "AI summary unavailable.")
    except Exception as e:
        logger.warning(f"AI summary generation failed: {e}")
        risk_label = (
            "critical"
            if overall_risk >= 80
            else "high"
            if overall_risk >= 60
            else "moderate"
            if overall_risk >= 40
            else "low"
        )
        return (
            f"This PR modifies {len(changed_files)} file(s) with an overall risk score of {overall_risk}/100 ({risk_label}). "
            f"{len(high_risk_files)} file(s) carry high blast radius. "
            f"{'Circular dependencies detected — resolve before merge. ' if circular else ''}"
            f"Standard review process recommended."
        )


def _architecture_violations_for_files(graph_engine, user_id: str, paths: List[str]) -> List[str]:
    out: List[str] = []
    if not graph_engine or not graph_engine.driver:
        return out
    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            result = session.run(
                """
                MATCH (a:CodeNode {user_id: $user_id})-[r:DEPENDS_ON]->(b:CodeNode {user_id: $user_id})
                WHERE r.architecture_violation = true AND (a.id IN $files OR b.id IN $files)
                RETURN DISTINCT a.id AS src, b.id AS dst, coalesce(r.violation_rule, 'layer') AS rule
                LIMIT 25
                """,
                user_id=user_id,
                files=paths[:50],
            )
            for rec in result:
                out.append(f"{rec.get('src')} -> {rec.get('dst')} ({rec.get('rule')})")
    except Exception as e:
        logger.debug(f"Architecture violations query skipped: {e}")
    return out


def _prod_incident_touch(graph_engine, user_id: str, paths: List[str]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not graph_engine or not graph_engine.driver:
        return rows
    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            result = session.run(
                """
                MATCH (n:CodeNode {user_id: $user_id})
                WHERE n.id IN $files AND coalesce(n.prod_incidents_7d, 0) > 0
                RETURN n.id AS file, n.prod_incidents_7d AS incidents
                ORDER BY incidents DESC
                LIMIT 20
                """,
                user_id=user_id,
                files=paths[:50],
            )
            for rec in result:
                rows.append({"file": rec["file"], "incidents_7d": int(rec["incidents"] or 0)})
    except Exception as e:
        logger.debug(f"Prod incident touch query skipped: {e}")
    return rows


async def run_pr_analysis(
    user_id: str,
    pr_url: Optional[str],
    changed_files: Optional[List[str]],
    get_ingestion_service: Callable[[str], Any],
    get_rag_service: Callable[[str], Any],
) -> PRReviewResponse:
    """Full PR analysis (used by REST and GitHub webhooks)."""
    changed: List[str] = list(changed_files or [])

    if not changed and pr_url:
        try:
            owner, repo, pr_num = _parse_github_pr(pr_url)
            changed = await _fetch_github_pr_files(owner, repo, pr_num)
        except HTTPException:
            raise
        except Exception as e:
            detail = (str(e) or "").strip() or repr(e) or type(e).__name__
            logger.exception("Could not fetch PR files from GitHub: %s", detail)
            raise HTTPException(400, f"Could not fetch PR files: {detail}") from e

    if not changed:
        raise HTTPException(400, "No changed files provided or detected.")

    changed = changed[:50]

    try:
        ingestion_service = get_ingestion_service(user_id)
        graph_engine = ingestion_service.graph_engine
    except Exception as e:
        raise HTTPException(500, f"Graph engine unavailable: {e}") from e

    loop = asyncio.get_event_loop()
    file_risks_raw = await asyncio.gather(
        *[loop.run_in_executor(None, _compute_file_risk, f, graph_engine, user_id) for f in changed],
        return_exceptions=True,
    )
    file_risks: List[FileRisk] = [r for r in file_risks_raw if isinstance(r, FileRisk)]

    circular_files = await loop.run_in_executor(None, _detect_circular_deps, changed, graph_engine, user_id)
    circular_set = set(circular_files)
    for fr in file_risks:
        if fr.file in circular_set:
            fr.is_new_circular_dep = True

    blast_files = await loop.run_in_executor(None, _collect_blast_union, changed, graph_engine, user_id)

    arch_violations = await loop.run_in_executor(
        None, _architecture_violations_for_files, graph_engine, user_id, changed
    )
    prod_touch = await loop.run_in_executor(None, _prod_incident_touch, graph_engine, user_id, changed)

    if file_risks:
        overall_risk = min(
            100,
            int(
                sum(fr.risk_score for fr in file_risks) / len(file_risks)
                + len(circular_files) * 10
                + sum(10 for fr in file_risks if fr.bus_risk >= 0.7)
                + len(arch_violations) * 5
                + sum(min(15, int(t.get("incidents_7d", 0))) for t in prod_touch)
            ),
        )
    else:
        overall_risk = 0

    if prod_touch and overall_risk < 95:
        overall_risk = min(100, overall_risk + 10)

    risk_level = (
        "CRITICAL"
        if overall_risk >= 80
        else "HIGH"
        if overall_risk >= 60
        else "MEDIUM"
        if overall_risk >= 40
        else "LOW"
    )
    if prod_touch and risk_level == "HIGH":
        risk_level = "CRITICAL"

    suggested_reviewers = await loop.run_in_executor(None, _suggest_reviewers, file_risks, graph_engine, user_id)
    ci_checklist = _build_ci_checklist(file_risks, blast_files)

    extra_notes = ""
    if arch_violations:
        extra_notes += f"Architecture violations touching this PR: {len(arch_violations)}.\n"
    if prod_touch:
        extra_notes += f"Production hot files (7d incidents): {prod_touch[:5]}.\n"

    try:
        rag_service = get_rag_service(user_id)
        ai_summary = await _generate_ai_summary(pr_url, changed, file_risks, overall_risk, rag_service, extra_notes)
    except Exception as e:
        logger.warning(f"Could not get RAG service: {e}")
        ai_summary = f"Analysis complete. {len(changed)} files changed, overall risk: {overall_risk}/100."

    ownership_changes = [
        {
            "file": fr.file,
            "owner": fr.owner,
            "bus_risk": fr.bus_risk,
            "collaborators": fr.collaborators[:3],
        }
        for fr in file_risks
        if fr.bus_risk >= 0.5
    ]

    return PRReviewResponse(
        pr_url=pr_url,
        overall_risk=overall_risk,
        risk_level=risk_level,
        changed_files=changed,
        file_risks=file_risks,
        blast_files=blast_files[:100],
        new_circular_deps=circular_files,
        bus_factor_regressions=[
            {"file": fr.file, "owner": fr.owner, "bus_risk": fr.bus_risk}
            for fr in file_risks
            if fr.bus_risk >= 0.7
        ],
        suggested_reviewers=suggested_reviewers,
        ci_checklist=ci_checklist,
        ai_summary=ai_summary,
        ownership_changes=ownership_changes,
        architecture_violations=arch_violations,
        prod_incident_touch=prod_touch,
    )
