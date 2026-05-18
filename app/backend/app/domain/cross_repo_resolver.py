"""
Cross-repo / workspace: create Repo nodes and SAME_WORKSPACE edges from SQL workspaces.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger("dex-cross-repo")


def _scan_openapi_endpoints(repo_root: str) -> List[Dict[str, Any]]:
    """Best-effort scan for openapi/swagger JSON files (first 5 files, shallow paths)."""
    out: List[Dict[str, Any]] = []
    if not repo_root or not os.path.isdir(repo_root):
        return out
    candidates = []
    for root, _, files in os.walk(repo_root):
        depth = root[len(repo_root) :].count(os.sep)
        if depth > 4:
            continue
        for fn in files:
            low = fn.lower()
            if low in ("openapi.json", "openapi.yaml", "swagger.json", "swagger.yaml"):
                candidates.append(os.path.join(root, fn))
        if len(candidates) >= 8:
            break
    for fp in candidates[:5]:
        try:
            with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                raw = f.read()
            if fp.endswith((".yaml", ".yml")):
                try:
                    import yaml

                    data = yaml.safe_load(raw) or {}
                except Exception:
                    continue
            else:
                data = json.loads(raw)
            paths = (data or {}).get("paths") or {}
            for path, methods in list(paths.items())[:40]:
                if not isinstance(methods, dict):
                    continue
                for method, spec in methods.items():
                    if method.lower() not in ("get", "post", "put", "patch", "delete", "options"):
                        continue
                    out.append({"path": path, "method": method.upper(), "source_file": os.path.relpath(fp, repo_root)})
        except Exception as e:
            logger.debug(f"openapi parse skip {fp}: {e}")
    return out


def link_workspace_repos_neo4j(user_id: str, graph_engine) -> None:
    """MERGE Repo nodes for user's workspaces and SAME_WORKSPACE links."""
    if not graph_engine or not graph_engine.driver:
        return
    try:
        from sqlalchemy.orm import sessionmaker
        from backend.app.models.user import engine
        from backend.app.models.engineering_models import Workspace, WorkspaceRepo

        Session = sessionmaker(bind=engine)
        db = Session()
        try:
            workspaces = db.query(Workspace).filter(Workspace.user_id == user_id).all()
        finally:
            db.close()
    except Exception as e:
        logger.debug(f"workspace SQL read skipped: {e}")
        return

    if not workspaces:
        return

    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            for ws in workspaces:
                repos = sorted(ws.repos or [], key=lambda r: r.sort_order)
                ids = []
                for r in repos:
                    rid = (r.repo_full_name or "").strip()
                    if not rid:
                        continue
                    session.run(
                        """
                        MERGE (repo:Repo {user_id: $user_id, id: $rid})
                        SET repo.name = $rid, repo.workspace_id = $wid
                        """,
                        user_id=user_id,
                        rid=rid,
                        wid=ws.id,
                    )
                    ids.append(rid)
                for i in range(len(ids) - 1):
                    session.run(
                        """
                        MATCH (a:Repo {user_id: $user_id, id: $a}), (b:Repo {user_id: $user_id, id: $b})
                        MERGE (a)-[:SAME_WORKSPACE {workspace_id: $wid}]->(b)
                        """,
                        user_id=user_id,
                        a=ids[i],
                        b=ids[i + 1],
                        wid=ws.id,
                    )
    except Exception as e:
        logger.warning(f"link_workspace_repos_neo4j failed: {e}")


def attach_openapi_service_nodes(user_id: str, graph_engine, repo_root: str, repo_slug: str) -> int:
    """Create lightweight (:ServiceEndpoint) nodes linked from Repo (optional enrichment)."""
    if not graph_engine or not graph_engine.driver or not repo_slug:
        return 0
    eps = _scan_openapi_endpoints(repo_root)
    if not eps:
        return 0
    count = 0
    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            session.run(
                """
                MERGE (repo:Repo {user_id: $user_id, id: $slug})
                SET repo.name = $slug
                """,
                user_id=user_id,
                slug=repo_slug,
            )
            for ep in eps[:80]:
                eid = f"{ep['method']}:{ep['path']}"
                session.run(
                    """
                    MATCH (repo:Repo {user_id: $user_id, id: $slug})
                    MERGE (e:ServiceEndpoint {user_id: $user_id, id: $eid})
                    SET e.path = $path, e.method = $method, e.source_file = $sf
                    MERGE (repo)-[:EXPOSES]->(e)
                    """,
                    user_id=user_id,
                    slug=repo_slug,
                    eid=repo_slug + "::" + eid,
                    path=ep.get("path"),
                    method=ep.get("method"),
                    sf=ep.get("source_file"),
                )
                count += 1
    except Exception as e:
        logger.debug(f"attach_openapi_service_nodes: {e}")
    return count


def infer_http_calls_to_endpoints(user_id: str, graph_engine, repo_slug: str) -> int:
    """
    Regex scan CodeNode file ids for https://api... patterns; MERGE CALLS_API to generic external node.
    """
    if not graph_engine or not graph_engine.driver:
        return 0
    n_edges = 0
    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            res = session.run(
                """
                MATCH (n:CodeNode {user_id: $user_id})
                WHERE n.type = 'file' AND coalesce(n.repo_full_name,'') = $slug
                RETURN n.id AS id
                LIMIT 400
                """,
                user_id=user_id,
                slug=repo_slug,
            )
            file_ids = [r["id"] for r in res]
        # We don't have file contents in Neo4j; skip content scan — placeholder for future ingestion hook
        _ = file_ids
    except Exception as e:
        logger.debug(f"infer_http_calls_to_endpoints: {e}")
    return n_edges
