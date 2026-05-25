"""
Bridge DEX Neo4j graphs to a teaching-oriented model (Understand-Anything–inspired)
with DEX metadata: git ownership, risk, architecture layers.
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

# Layer palette (UA-style architectural grouping + DEX heuristics)
LAYER_DEFS: List[Dict[str, Any]] = [
    {
        "id": "api",
        "name": "API",
        "description": "HTTP routes, controllers, handlers, GraphQL",
        "color": "#6366f1",
        "patterns": [
            "api/", "apis/", "routes/", "route/", "controllers/", "controller/",
            "handlers/", "handler/", "endpoints/", "graphql/", "routers/", "router/",
        ],
    },
    {
        "id": "service",
        "name": "Service",
        "description": "Business logic, domain services, use cases",
        "color": "#8b5cf6",
        "patterns": [
            "services/", "service/", "domain/", "usecases/", "use_cases/",
            "application/", "app/backend/", "core/",
        ],
    },
    {
        "id": "data",
        "name": "Data",
        "description": "Database, models, repositories, migrations",
        "color": "#06b6d4",
        "patterns": [
            "models/", "model/", "db/", "database/", "repositories/", "repository/",
            "repo/", "migrations/", "migration/", "schema/", "dal/",
        ],
    },
    {
        "id": "ui",
        "name": "UI",
        "description": "Frontend, components, pages, views",
        "color": "#f59e0b",
        "patterns": [
            "frontend/", "ui/", "components/", "pages/", "views/", "src/app/",
            "widgets/", "screens/",
        ],
    },
    {
        "id": "util",
        "name": "Utility",
        "description": "Shared helpers, config, scripts",
        "color": "#64748b",
        "patterns": [
            "utils/", "util/", "helpers/", "lib/", "common/", "shared/",
            "config/", "scripts/", "tools/",
        ],
    },
    {
        "id": "other",
        "name": "Other",
        "description": "Unclassified project files",
        "color": "#475569",
        "patterns": [],
    },
]

_LAYER_BY_ID = {d["id"]: d for d in LAYER_DEFS}
LAYER_BY_ID = _LAYER_BY_ID


def _norm_path(p: str) -> str:
    return (p or "").replace("\\", "/").lower()


def infer_layer(node: Dict[str, Any]) -> str:
    """Resolve architectural layer from Neo4j tag or path heuristics."""
    explicit = (node.get("layer") or "").strip().lower()
    if explicit:
        for lid, meta in _LAYER_BY_ID.items():
            if explicit == lid or explicit == meta["name"].lower():
                return lid
        return "other"

    node_id = _norm_path(str(node.get("id") or node.get("name") or ""))
    node_type = (node.get("type") or "file").lower()

    if node_type in ("folder", "module"):
        for layer in LAYER_DEFS:
            if layer["id"] == "other":
                continue
            for pat in layer["patterns"]:
                if node_id.startswith(pat) or f"/{pat}" in node_id:
                    return layer["id"]

    for layer in LAYER_DEFS:
        if layer["id"] == "other":
            continue
        for pat in layer["patterns"]:
            if pat in node_id:
                return layer["id"]

    return "other"


def _build_summary(node: Dict[str, Any], layer_id: str) -> str:
    """Plain-English line for teaching UI (DEX touch: ownership + risk)."""
    name = node.get("name") or node.get("id") or "Unknown"
    ntype = (node.get("type") or "file").capitalize()
    layer_name = _LAYER_BY_ID.get(layer_id, {}).get("name", "Other")
    parts = [f"{ntype} in the {layer_name} layer: {name}."]

    owner = node.get("top_owner") or node.get("last_author")
    if owner and owner not in ("None", "Unknown", ""):
        parts.append(f" Primary owner: {owner}.")

    risk = node.get("bus_risk_score")
    if isinstance(risk, (int, float)) and risk >= 0.5:
        parts.append(" Elevated bus-factor risk.")

    if node.get("api_route"):
        parts.append(" Exposes an API route.")

    return "".join(parts)


def to_teaching_node(raw: Dict[str, Any]) -> Dict[str, Any]:
    layer_id = infer_layer(raw)
    meta = _LAYER_BY_ID.get(layer_id, _LAYER_BY_ID["other"])
    ntype = (raw.get("type") or "file").lower()
    if ntype not in ("file", "function", "class", "module", "folder"):
        ntype = "file"

    return {
        "id": raw.get("id"),
        "name": raw.get("name") or raw.get("id"),
        "type": ntype,
        "layer": layer_id,
        "layerName": meta["name"],
        "color": meta["color"],
        "summary": _build_summary(raw, layer_id),
        "val": raw.get("val") or (12 if ntype == "file" else 6),
        "complexity": "moderate",
        "tags": [layer_id],
        "dex": {
            "top_owner": raw.get("top_owner"),
            "bus_risk_score": raw.get("bus_risk_score"),
            "last_author": raw.get("last_author"),
            "api_route": raw.get("api_route"),
            "infrastructure": raw.get("infrastructure"),
        },
    }


def _normalize_link(link: Dict[str, Any]) -> Dict[str, str]:
    src = link.get("source")
    tgt = link.get("target")
    if hasattr(src, "id"):
        src = src.id
    if hasattr(tgt, "id"):
        tgt = tgt.id
    return {
        "source": str(src),
        "target": str(tgt),
        "type": (link.get("relation") or link.get("type") or "depends_on").lower(),
    }


def build_layer_overview(
    nodes: List[Dict[str, Any]],
    links: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Collapsed view: one super-node per architectural layer + inter-layer edges.
    Only important layers with at least one file are returned.
    """
    files_by_layer: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    node_layer_map: Dict[str, str] = {}

    for raw in nodes:
        nid = raw.get("id")
        if not nid:
            continue
        layer_id = infer_layer(raw)
        node_layer_map[nid] = layer_id
        if (raw.get("type") or "").lower() in ("file", "folder", "module"):
            files_by_layer[layer_id].append(raw)

    layer_nodes: List[Dict[str, Any]] = []
    layer_edges: List[Dict[str, Any]] = []
    inter_layer_counts: Dict[Tuple[str, str], int] = defaultdict(int)

    for link in links:
        norm = _normalize_link(link)
        sl = node_layer_map.get(norm["source"])
        tl = node_layer_map.get(norm["target"])
        if not sl or not tl or sl == tl:
            continue
        if norm["type"] in ("depends_on", "imports", "defines"):
            inter_layer_counts[(sl, tl)] += 1

    for layer_id, meta in _LAYER_BY_ID.items():
        files = files_by_layer.get(layer_id) or []
        if not files and layer_id == "other":
            continue
        if not files:
            continue

        top_names = sorted(
            [f.get("name") or f.get("id") for f in files],
            key=lambda x: len(str(x)),
        )[:5]
        count = len(files)
        layer_nodes.append({
            "id": f"layer:{layer_id}",
            "name": meta["name"],
            "type": "layer",
            "layer": layer_id,
            "layerName": meta["name"],
            "color": meta["color"],
            "summary": (
                f"{meta['description']} — {count} file(s). "
                f"Examples: {', '.join(str(n) for n in top_names[:3])}."
            ),
            "val": min(8 + count * 0.5, 40),
            "fileCount": count,
            "isLayerGroup": True,
            "tags": ["layer", layer_id],
        })

    active_layers = {n["layer"] for n in layer_nodes}
    for (src_l, tgt_l), weight in sorted(
        inter_layer_counts.items(), key=lambda x: -x[1]
    )[:24]:
        if src_l not in active_layers or tgt_l not in active_layers:
            continue
        layer_edges.append({
            "source": f"layer:{src_l}",
            "target": f"layer:{tgt_l}",
            "type": "depends_on",
            "weight": min(1.0, weight / 10.0),
            "description": f"{weight} cross-layer dependencies",
        })

    return {
        "view": "overview",
        "nodes": layer_nodes,
        "edges": layer_edges,
        "layers": [
            {
                "id": d["id"],
                "name": d["name"],
                "description": d["description"],
                "color": d["color"],
                "nodeIds": [n["id"] for n in layer_nodes if n["layer"] == d["id"]],
            }
            for d in LAYER_DEFS
            if d["id"] in active_layers
        ],
    }


def _score_node(query_tokens: List[str], node: Dict[str, Any], layer_hint: Optional[str]) -> float:
    text = " ".join(
        [
            str(node.get("id") or ""),
            str(node.get("name") or ""),
            str(node.get("layer") or ""),
            infer_layer(node),
        ]
    ).lower()
    score = 0.0
    for tok in query_tokens:
        if len(tok) < 2:
            continue
        if tok in text:
            score += 3.0
        if any(part in text for part in text.split("/") if tok in part):
            score += 2.0
    if layer_hint and infer_layer(node) == layer_hint:
        score += 5.0
    if (node.get("type") or "").lower() == "file":
        score += 0.5
    return score


def focus_subgraph(
    nodes: List[Dict[str, Any]],
    links: List[Dict[str, Any]],
    query: str,
    *,
    layer_id: Optional[str] = None,
    max_nodes: int = 120,
    depth: int = 2,
) -> Dict[str, Any]:
    """
    Extract a teaching subgraph for a natural-language focus (service, path, feature).
    """
    q = (query or "").strip()
    layer_hint = (layer_id or "").strip().lower() or None

    if not q and not layer_hint:
        return {"view": "focus", "nodes": [], "edges": [], "matched": [], "query": q}

    query_tokens = re.findall(r"[a-zA-Z0-9_\-]+", q.lower()) if q else []

    raw_by_id = {n["id"]: n for n in nodes if n.get("id")}
    adjacency: Dict[str, Set[str]] = defaultdict(set)

    for link in links:
        norm = _normalize_link(link)
        if norm["source"] in raw_by_id and norm["target"] in raw_by_id:
            adjacency[norm["source"]].add(norm["target"])
            adjacency[norm["target"]].add(norm["source"])

    seeds: List[Tuple[float, str]] = []
    for nid, raw in raw_by_id.items():
        if layer_hint and infer_layer(raw) != layer_hint:
            continue
        sc = _score_node(query_tokens, raw, layer_hint) if query_tokens else (1.0 if layer_hint else 0.0)
        if layer_hint and not query_tokens and infer_layer(raw) == layer_hint:
            sc = 1.0
        if sc > 0:
            seeds.append((sc, nid))

    seeds.sort(key=lambda x: -x[0])
    seed_ids = [s[1] for s in seeds[:15]]

    if layer_hint and not seed_ids:
        seed_ids = [
            nid
            for nid, raw in raw_by_id.items()
            if infer_layer(raw) == layer_hint and (raw.get("type") or "").lower() == "file"
        ][:20]

    visited: Set[str] = set()
    frontier = list(seed_ids)
    for _ in range(max(1, depth)):
        next_frontier: List[str] = []
        for nid in frontier:
            if nid in visited:
                continue
            visited.add(nid)
            for neighbor in adjacency.get(nid, []):
                if neighbor not in visited and len(visited) < max_nodes:
                    next_frontier.append(neighbor)
        frontier = next_frontier
        if len(visited) >= max_nodes:
            break

    visited = set(list(visited)[:max_nodes])
    teaching_nodes = [to_teaching_node(raw_by_id[nid]) for nid in visited if nid in raw_by_id]
    teaching_edges = []
    for link in links:
        norm = _normalize_link(link)
        if norm["source"] in visited and norm["target"] in visited:
            teaching_edges.append({
                "source": norm["source"],
                "target": norm["target"],
                "type": norm["type"],
                "weight": 0.6,
            })

    return {
        "view": "focus",
        "query": q,
        "layer": layer_hint,
        "matched": seed_ids[:10],
        "nodes": teaching_nodes,
        "edges": teaching_edges,
        "layers": [
            {
                "id": d["id"],
                "name": d["name"],
                "color": d["color"],
                "nodeIds": [n["id"] for n in teaching_nodes if n.get("layer") == d["id"]],
            }
            for d in LAYER_DEFS
        ],
    }


def expand_layer(
    nodes: List[Dict[str, Any]],
    links: List[Dict[str, Any]],
    layer_id: str,
    *,
    max_nodes: int = 80,
) -> Dict[str, Any]:
    """Expand a layer group into file-level teaching nodes (still scoped)."""
    return focus_subgraph(
        nodes,
        links,
        query="",
        layer_id=layer_id,
        max_nodes=max_nodes,
        depth=1,
    )


def full_teaching_graph(
    nodes: List[Dict[str, Any]],
    links: List[Dict[str, Any]],
    *,
    limit: int = 400,
) -> Dict[str, Any]:
    """Full graph in teaching format for force-directed view (capped)."""
    capped = nodes[:limit]
    ids = {n["id"] for n in capped if n.get("id")}
    teaching_nodes = [to_teaching_node(n) for n in capped]
    teaching_edges = []
    for link in links:
        norm = _normalize_link(link)
        if norm["source"] in ids and norm["target"] in ids:
            teaching_edges.append({
                "source": norm["source"],
                "target": norm["target"],
                "type": norm["type"],
                "weight": 0.4,
            })
    return {
        "view": "full",
        "nodes": teaching_nodes,
        "edges": teaching_edges,
        "truncated": len(nodes) > limit,
        "totalNodes": len(nodes),
    }
