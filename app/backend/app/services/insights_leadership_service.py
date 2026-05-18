"""Aggregate metrics for the leadership dashboard."""
from __future__ import annotations

import json
import logging
import os
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger("dex-insights")


def _history_path(user_id: str) -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    return os.path.join(base_dir, "backend", "data", user_id, "repo_history.json")


def compute_leadership_payload(user_id: str, graph_engine) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "bus_factor_trend": [],
        "top_risk_files": [],
        "unowned_surface_pct": 0.0,
        "pr_throughput": [],
        "architecture_violations_this_week": 0,
        "incidents_this_week": 0,
        "ownership_heatmap": [],
        "concentration_alerts": [],
    }

    # --- Neo4j aggregates ---
    if graph_engine and graph_engine.driver:
        try:
            with graph_engine.driver.session(database=graph_engine.database) as session:
                r = session.run(
                    """
                    MATCH (n:CodeNode {user_id: $user_id})
                    WHERE n.type = 'file'
                    RETURN avg(coalesce(n.bus_risk_score, 0)) AS avg_bus,
                           count(n) AS total_files,
                           sum(CASE WHEN n.top_owner IS NULL OR n.top_owner IN ['', 'None', 'Unknown'] THEN 1 ELSE 0 END) AS unowned
                    """,
                    user_id=user_id,
                )
                row = r.single()
                if row and row.get("total_files"):
                    total = int(row["total_files"] or 1)
                    unowned = int(row["unowned"] or 0)
                    out["unowned_surface_pct"] = round(100.0 * unowned / total, 2)

                r2 = session.run(
                    """
                    MATCH (n:CodeNode {user_id: $user_id})
                    WHERE n.type = 'file'
                    OPTIONAL MATCH (d:CodeNode {user_id: $user_id})-[r]->(n)
                    WHERE type(r) IN ['DEPENDS_ON','IMPORTS','CALLS']
                    WITH n, coalesce(n.bus_risk_score,0) AS br, count(DISTINCT d) AS fan_in
                    RETURN n.id AS fid, n.top_owner AS owner, br, fan_in, coalesce(n.prod_incidents_7d,0) AS inc
                    ORDER BY (br * (10 + fan_in) * (1 + coalesce(n.prod_incidents_7d,0))) DESC
                    LIMIT 12
                    """,
                    user_id=user_id,
                )
                for rec in r2:
                    fan = int(rec["fan_in"] or 0)
                    br = float(rec["br"] or 0)
                    inc = int(rec["inc"] or 0)
                    score = int(min(100, br * 50 + fan * 2 + inc * 3))
                    out["top_risk_files"].append(
                        {
                            "file": rec["fid"],
                            "owner": rec["owner"],
                            "score": score,
                            "fan_in": fan,
                            "incidents_7d": inc,
                        }
                    )

                r3 = session.run(
                    """
                    MATCH (:CodeNode {user_id: $user_id})-[r:DEPENDS_ON]->(:CodeNode {user_id: $user_id})
                    WHERE r.architecture_violation = true
                    RETURN count(r) AS c
                    """,
                    user_id=user_id,
                )
                rec3 = r3.single()
                out["architecture_violations_this_week"] = int(rec3["c"] or 0) if rec3 else 0

                r4 = session.run(
                    """
                    MATCH (n:CodeNode {user_id: $user_id})
                    WHERE coalesce(n.prod_incidents_7d,0) > 0
                    RETURN sum(n.prod_incidents_7d) AS s
                    """,
                    user_id=user_id,
                )
                rec4 = r4.single()
                out["incidents_this_week"] = int(rec4["s"] or 0) if rec4 else 0

                # Ownership heatmap by top-level directory
                r5 = session.run(
                    """
                    MATCH (n:CodeNode {user_id: $user_id})
                    WHERE n.type = 'file'
                    WITH split(replace(n.id, '\\\\', '/'), '/')[0] AS zone, n.top_owner AS owner
                    RETURN zone, count(*) AS cnt, count(DISTINCT owner) AS owners
                    ORDER BY cnt DESC
                    LIMIT 24
                    """,
                    user_id=user_id,
                )
                for rec in r5:
                    z = rec["zone"] or "root"
                    cnt = int(rec["cnt"] or 0)
                    owners = int(rec["owners"] or 0)
                    concentration = 1.0 - (owners / max(cnt, 1))
                    out["ownership_heatmap"].append(
                        {
                            "zone": z,
                            "files": cnt,
                            "distinct_owners": owners,
                            "concentration": round(concentration, 3),
                        }
                    )
                    if cnt >= 5 and owners <= 1:
                        out["concentration_alerts"].append(
                            {
                                "zone": z,
                                "message": f"Directory '{z}' has {cnt} files but only {owners} distinct owner(s) — knowledge concentration risk.",
                            }
                        )
        except Exception as e:
            logger.error(f"Leadership Neo4j aggregate failed: {e}")

    # --- Git timeline: synthetic weekly bus trend + PR throughput ---
    path = _history_path(user_id)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                timeline = json.load(f)
        except Exception:
            timeline = []
        week_commits: Counter = Counter()
        week_authors: Dict[str, Counter] = defaultdict(Counter)
        cutoff = (datetime.now() - timedelta(days=56)).isoformat()
        for commit in timeline:
            d = commit.get("date", "")[:10]
            if d < cutoff[:10]:
                continue
            week_key = d[:7]  # YYYY-MM as simple bucket
            week_commits[week_key] += 1
            author = commit.get("author") or "unknown"
            week_authors[week_key][author] += 1

        for wk in sorted(week_commits.keys())[-8:]:
            authors = week_authors[wk]
            total = sum(authors.values()) or 1
            top_share = max(authors.values()) / total if authors else 0
            out["bus_factor_trend"].append({"week": wk, "commits": week_commits[wk], "top_author_share": round(top_share, 3)})

        # PR throughput proxy: commits per week by author
        per_week_author = defaultdict(int)
        for commit in timeline:
            d = (commit.get("date", "") or "")[:10]
            if d < cutoff[:10]:
                continue
            wk = d[:7]
            per_week_author[wk] += 1
        for wk in sorted(per_week_author.keys())[-8:]:
            out["pr_throughput"].append({"week": wk, "events": per_week_author[wk]})

    return out
