"""
Architecture drift: dex.architecture.yaml → layer tags on CodeNode + violation flags on DEPENDS_ON.
"""
from __future__ import annotations

import fnmatch
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("dex-architecture")

try:
    import yaml

    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False


def _norm_path(p: str) -> str:
    return (p or "").replace("\\", "/").lstrip("./")


def load_dex_architecture_yaml(repo_root: str) -> Optional[Dict[str, Any]]:
    if not YAML_AVAILABLE:
        return None
    for name in ("dex.architecture.yaml", "dex.architecture.yml"):
        fp = os.path.join(repo_root, name)
        if os.path.isfile(fp):
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    return yaml.safe_load(f) or {}
            except Exception as e:
                logger.warning(f"Failed to parse {fp}: {e}")
    return None


def path_matches_any_pattern(rel_path: str, patterns: List[str]) -> bool:
    rel = _norm_path(rel_path)
    for pat in patterns or []:
        patn = _norm_path(pat)
        if fnmatch.fnmatch(rel, patn) or fnmatch.fnmatch(rel, "**/" + patn):
            return True
        # simple prefix
        if patn.endswith("/**"):
            prefix = patn[:-3]
            if rel.startswith(prefix):
                return True
    return False


def resolve_layer_for_path(rel_path: str, layers: List[Dict[str, Any]]) -> str:
    for layer in layers or []:
        name = layer.get("name") or ""
        paths = layer.get("paths") or []
        if path_matches_any_pattern(rel_path, paths):
            return str(name)
    return ""


def forbidden_pair(layer_a: str, layer_b: str, layers: List[Dict[str, Any]]) -> Optional[str]:
    if not layer_a or not layer_b or layer_a == layer_b:
        return None
    for layer in layers or []:
        if (layer.get("name") or "") != layer_a:
            continue
        banned = layer.get("cannot_depend_on") or []
        if layer_b in banned:
            return f"{layer_a}→{layer_b}"
    return None


def apply_architecture_layers_after_ingestion(graph_engine, repo_root: str, user_id: str) -> Dict[str, int]:
    """
    Set CodeNode.layer from YAML; mark DEPENDS_ON edges that violate layer rules.
    Returns counts {layers_set, violations_tagged}.
    """
    cfg = load_dex_architecture_yaml(repo_root)
    if not cfg:
        return {"layers_set": 0, "violations_tagged": 0}

    layers: List[Dict[str, Any]] = cfg.get("layers") or []
    if not layers or not graph_engine.driver:
        return {"layers_set": 0, "violations_tagged": 0}

    # Collect file paths from Neo4j
    file_ids: List[str] = []
    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            res = session.run(
                """
                MATCH (n:CodeNode {user_id: $user_id})
                WHERE n.type = 'file'
                RETURN n.id AS id
                """,
                user_id=user_id,
            )
            file_ids = [r["id"] for r in res if r.get("id")]
    except Exception as e:
        logger.error(f"Failed to list file nodes: {e}")
        return {"layers_set": 0, "violations_tagged": 0}

    updates = []
    for fid in file_ids:
        rel = _norm_path(fid)
        layer = resolve_layer_for_path(rel, layers)
        updates.append({"id": fid, "layer": layer or ""})

    layers_set = 0
    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            session.run(
                """
                UNWIND $rows AS row
                MATCH (n:CodeNode {user_id: $user_id, id: row.id})
                SET n.layer = row.layer
                """,
                user_id=user_id,
                rows=updates[:5000],
            )
            layers_set = len(updates)
    except Exception as e:
        logger.error(f"Layer batch update failed: {e}")

    violations = 0
    try:
        with graph_engine.driver.session(database=graph_engine.database) as session:
            session.run(
                """
                MATCH (:CodeNode {user_id: $user_id})-[r:DEPENDS_ON]->(:CodeNode {user_id: $user_id})
                REMOVE r.architecture_violation, r.violation_rule
                """,
                user_id=user_id,
            )
            res = list(
                session.run(
                    """
                    MATCH (a:CodeNode {user_id: $user_id})-[r:DEPENDS_ON]->(b:CodeNode {user_id: $user_id})
                    WHERE coalesce(a.layer,'') <> '' AND coalesce(b.layer,'') <> ''
                    RETURN a.layer AS la, b.layer AS lb, a.id AS src, b.id AS dst
                    LIMIT 5000
                    """,
                    user_id=user_id,
                )
            )
            rows = []
            for rec in res:
                rule = forbidden_pair(rec["la"], rec["lb"], layers)
                if rule:
                    rows.append({"src": rec["src"], "dst": rec["dst"], "rule": rule})
            violations = len(rows)
            if rows:
                session.run(
                    """
                    UNWIND $rows AS row
                    MATCH (a:CodeNode {user_id: $user_id})-[r:DEPENDS_ON]->(b:CodeNode {user_id: $user_id})
                    WHERE a.id = row.src AND b.id = row.dst
                    SET r.architecture_violation = true, r.violation_rule = row.rule
                    """,
                    user_id=user_id,
                    rows=rows[:2000],
                )
    except Exception as e:
        logger.error(f"Violation tagging failed: {e}")

    return {"layers_set": layers_set, "violations_tagged": violations}


def record_architecture_snapshot(user_id: str, violation_count: int) -> None:
    """Persist weekly snapshot row (Postgres)."""
    try:
        from datetime import datetime
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import sessionmaker
        from backend.app.core.config import settings

        week_start = datetime.utcnow().date().isoformat()[:10]
        engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        Session = sessionmaker(bind=engine)
        db = Session()
        try:
            db.execute(
                text(
                    """
                    INSERT INTO architecture_snapshots (user_id, week_start, violation_count, created_at)
                    VALUES (:uid, :wk, :cnt, NOW())
                    ON CONFLICT (user_id, week_start) DO UPDATE SET
                      violation_count = EXCLUDED.violation_count
                    """
                ),
                {"uid": user_id, "wk": week_start, "cnt": violation_count},
            )
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.debug(f"architecture snapshot skipped: {e}")
