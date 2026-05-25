"""
Natural-language query → vector seeds → Neo4j expansion → UA-style teaching subgraph.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from backend.app.domain.graph_bridge import (
    LAYER_DEFS,
    LAYER_BY_ID,
    _score_node,
    infer_layer,
    to_teaching_node,
)
from backend.app.schemas.graph_subgraph import (
    LayerRef,
    MatchedSeed,
    ProjectMeta,
    SubgraphMeta,
    SubgraphResponse,
    SubgraphRequest,
    TeachingEdge,
    TeachingNode,
    TeachingNodeDex,
)

logger = logging.getLogger("dex-core")

VALID_LAYER_IDS = {d["id"] for d in LAYER_DEFS}

# Domain synonym expansion — maps broad intent words to related technical terms.
# Helps "show payment auth workflows" find real nodes even when exact tokens don't match.
_DOMAIN_EXPANSIONS: Dict[str, List[str]] = {
    "payment":        ["stripe", "billing", "checkout", "charge", "invoice", "subscription", "transaction", "cart", "order", "price", "webhook"],
    "auth":           ["authentication", "authorization", "jwt", "token", "oauth", "session", "login", "password", "credential", "cookie", "middleware"],
    "authentication": ["jwt", "token", "oauth", "session", "login", "password", "credential", "cookie"],
    "authorization":  ["permission", "role", "acl", "policy", "guard", "access"],
    "workflow":       ["pipeline", "flow", "process", "handler", "middleware", "task", "job", "queue", "worker", "scheduler"],
    "database":       ["model", "schema", "migration", "orm", "query", "repository", "dao", "entity", "table"],
    "api":            ["route", "endpoint", "controller", "router", "handler", "request", "response", "rest", "graphql"],
    "user":           ["account", "profile", "member", "customer", "identity", "signup", "register"],
    "notification":   ["email", "sms", "push", "alert", "event", "webhook", "message"],
    "upload":         ["storage", "file", "s3", "blob", "image", "media", "asset"],
    "search":         ["index", "query", "elasticsearch", "filter", "fuzzy", "ranking"],
    "cache":          ["redis", "memcache", "ttl", "invalidate", "store"],
    "test":           ["spec", "unit", "integration", "fixture", "mock", "assert"],
    "config":         ["setting", "environment", "env", "configuration", "constant"],
    "error":          ["exception", "handler", "logging", "monitoring", "sentry"],
}


def _expand_query_tokens(query: str) -> List[str]:
    """Return extra keyword tokens derived from domain synonym expansion of the query."""
    words = re.findall(r"[a-zA-Z0-9_\-]+", query.lower())
    extra: List[str] = []
    seen = set(words)
    for word in words:
        for synonym in _DOMAIN_EXPANSIONS.get(word, []):
            if synonym not in seen:
                extra.append(synonym)
                seen.add(synonym)
    return extra


def _empty_response(
    query: str,
    *,
    layer: Optional[str] = None,
    reason: str = "no_graph",
    project_name: str = "Repository",
) -> Dict[str, Any]:
    return SubgraphResponse(
        query=query.strip(),
        layer=layer,
        project=ProjectMeta(
            name=project_name,
            description=f"Focused subgraph for: {query.strip() or layer or 'query'}",
            languages=[],
            frameworks=[],
        ),
        matched=[],
        meta=SubgraphMeta(
            depth=2,
            maxNodes=120,
            reason=reason,
            seedSource="vector",
        ),
    ).model_dump()


def _project_meta(ingestion: Any, query: str) -> ProjectMeta:
    name = (
        getattr(ingestion, "last_repo_full_name", None)
        or getattr(ingestion, "last_ingested_repo_root", None)
        or "Repository"
    )
    if isinstance(name, str) and ("/" in name or "\\" in name):
        name = name.replace("\\", "/").rstrip("/").split("/")[-1] or "Repository"
    return ProjectMeta(
        name=str(name),
        description=f"Focused subgraph for: {query.strip()}",
        languages=[],
        frameworks=[],
        analyzedAt="",
        gitCommitHash="",
    )


def _raw_to_teaching_node(raw: Dict[str, Any]) -> TeachingNode:
    d = to_teaching_node(raw)
    dex = d.get("dex") or {}
    line_range = raw.get("line_range") or raw.get("lineRange")
    if isinstance(line_range, (list, tuple)) and len(line_range) >= 2:
        lr: Optional[List[int]] = [int(line_range[0]), int(line_range[1])]
    else:
        lr = None
    fp = raw.get("file_path") or raw.get("filePath")
    if not fp and "::" in str(d.get("id") or ""):
        fp = str(d["id"]).split("::")[0]
    api_route_raw = dex.get("api_route")
    if api_route_raw is True:
        api_route = "yes"
    elif api_route_raw is False or api_route_raw is None:
        api_route = None
    else:
        api_route = str(api_route_raw)

    return TeachingNode(
        id=str(d["id"]),
        name=str(d.get("name") or d["id"]),
        type=str(d.get("type") or "file"),
        layer=str(d.get("layer") or "other"),
        layerName=str(d.get("layerName") or "Other"),
        color=str(d.get("color") or "#475569"),
        summary=str(d.get("summary") or ""),
        val=float(d.get("val") or 12),
        complexity=d.get("complexity") or "moderate",
        tags=list(d.get("tags") or []),
        filePath=fp,
        lineRange=lr,
        dex=TeachingNodeDex(
            top_owner=dex.get("top_owner"),
            bus_risk_score=dex.get("bus_risk_score"),
            last_author=dex.get("last_author"),
            api_route=api_route,
            infrastructure=dex.get("infrastructure"),
        ),
    )


def _build_layers(teaching_nodes: List[TeachingNode]) -> List[LayerRef]:
    by_layer: Dict[str, List[str]] = {}
    for n in teaching_nodes:
        by_layer.setdefault(n.layer, []).append(n.id)
    out: List[LayerRef] = []
    for lid in [d["id"] for d in LAYER_DEFS]:
        ids = by_layer.get(lid)
        if not ids:
            continue
        meta = LAYER_BY_ID.get(lid, LAYER_BY_ID["other"])
        out.append(
            LayerRef(
                id=lid,
                name=meta["name"],
                description=meta.get("description", ""),
                color=meta["color"],
                nodeIds=ids,
            )
        )
    return out


def _keyword_seeds(
    graph_engine: Any,
    query: str,
    layer_hint: Optional[str],
    seed_k: int,
) -> List[MatchedSeed]:
    """Neo4j token search when vector search returns nothing."""
    tokens = re.findall(r"[a-zA-Z0-9_\-]+", query.lower())
    if not tokens and not layer_hint:
        return []
    raw = graph_engine.search_nodes_by_tokens(tokens, limit=seed_k * 2, layer_hint=layer_hint)
    scored: List[Tuple[float, str]] = []
    for node in raw:
        nid = node.get("id")
        if not nid:
            continue
        sc = _score_node(tokens, node, layer_hint) if tokens else 1.0
        if sc > 0:
            scored.append((sc, nid))
    scored.sort(key=lambda x: -x[0])
    max_sc = scored[0][0] if scored else 1.0
    out: List[MatchedSeed] = []
    for sc, nid in scored[:seed_k]:
        fuse_score = 1.0 - (sc / max_sc) if max_sc > 0 else 0.0
        out.append(MatchedSeed(nodeId=nid, score=round(min(1.0, max(0.0, fuse_score)), 4)))
    return out


class SubgraphExtractor:
    def __init__(self, ingestion_service: Any, rag_service: Any):
        self.ingestion = ingestion_service
        self.graph_engine = ingestion_service.graph_engine
        self.retriever = rag_service.retriever

    def extract(self, request: SubgraphRequest) -> Dict[str, Any]:
        t0 = time.time()
        q = request.query.strip()
        layer_hint = (request.layer or "").strip().lower() or None
        if layer_hint and layer_hint not in VALID_LAYER_IDS:
            layer_hint = None

        if not self.graph_engine or not getattr(self.graph_engine, "driver", None):
            return _empty_response(q, layer=layer_hint, reason="no_graph")

        project = _project_meta(self.ingestion, q)
        seed_source: str = "vector"
        matched: List[MatchedSeed] = []

        try:
            matched = self.retriever.find_fused_seed_nodes(q, k=request.seed_k, layer_hint=layer_hint)
            if not matched:
                matched = self.retriever.find_seed_nodes(q, k=request.seed_k, layer_hint=layer_hint)
        except Exception as e:
            logger.warning(f"Fused seed search failed, using keyword fallback: {e}")
            matched = []

        if not matched:
            matched = _keyword_seeds(self.graph_engine, q, layer_hint, request.seed_k)
            seed_source = "keyword" if matched else seed_source

        if layer_hint and not q and not matched:
            matched = _keyword_seeds(self.graph_engine, "", layer_hint, request.seed_k)
            seed_source = "layer"

        raw_seed_ids = [m.nodeId for m in matched]
        seed_ids = self.graph_engine.resolve_node_ids(raw_seed_ids)

        # Vector metadata often uses `/` while Neo4j may store `\` — retry keyword if resolve fails
        if not seed_ids and raw_seed_ids and q:
            logger.warning(
                "No vector seed ids resolved in Neo4j (%d candidates); using keyword fallback",
                len(raw_seed_ids),
            )
            matched = _keyword_seeds(self.graph_engine, q, layer_hint, request.seed_k)
            seed_source = "keyword"
            seed_ids = self.graph_engine.resolve_node_ids([m.nodeId for m in matched])

        if not seed_ids and layer_hint:
            seed_source = "layer"
            raw = self.graph_engine.search_nodes_by_tokens([], limit=20, layer_hint=layer_hint)
            seed_ids = self.graph_engine.resolve_node_ids([n["id"] for n in raw if n.get("id")])[:20]
            matched = [MatchedSeed(nodeId=sid, score=0.5) for sid in seed_ids[:10]]

        if not seed_ids:
            elapsed = int((time.time() - t0) * 1000)
            return SubgraphResponse(
                query=q,
                layer=layer_hint,
                project=project,
                matched=[],
                meta=SubgraphMeta(
                    depth=request.depth,
                    maxNodes=request.max_nodes,
                    reason="no_matches",
                    elapsedMs=elapsed,
                    seedSource=seed_source,
                ),
            ).model_dump()

        if matched and seed_source == "vector":
            kw = _keyword_seeds(self.graph_engine, q, layer_hint, max(3, request.seed_k // 2))
            if kw:
                seed_source = "mixed"
                seen = {m.nodeId for m in matched}
                for m in kw:
                    if m.nodeId not in seen:
                        matched.append(m)
                        seen.add(m.nodeId)
                seed_ids = list(seen)[: request.seed_k + 5]

        # Domain-expansion pass: if the query contains broad intent words (payment, auth,
        # workflow…), search for their technical synonyms so we find nodes that don't
        # literally contain the user's words.
        extra_tokens = _expand_query_tokens(q) if q else []
        if extra_tokens:
            expanded_query = q + " " + " ".join(extra_tokens)
            try:
                extra_matched = self.retriever.find_seed_nodes(
                    expanded_query, k=request.seed_k, layer_hint=layer_hint
                )
            except Exception:
                extra_matched = []
            if extra_matched:
                seen = {m.nodeId for m in matched}
                for m in extra_matched:
                    if m.nodeId not in seen:
                        matched.append(m)
                        seen.add(m.nodeId)
                if seed_source == "vector":
                    seed_source = "mixed"
            # Also enrich via keyword matching on the expanded tokens
            kw_extra = _keyword_seeds(
                self.graph_engine,
                expanded_query,
                layer_hint,
                max(5, request.seed_k // 2),
            )
            seen = {m.nodeId for m in matched}
            for m in kw_extra:
                if m.nodeId not in seen:
                    matched.append(m)
                    seen.add(m.nodeId)
            if matched:
                seed_ids = self.graph_engine.resolve_node_ids([m.nodeId for m in matched])

        expanded = self.graph_engine.expand_subgraph(
            seed_ids,
            depth=request.depth,
            max_nodes=request.max_nodes,
            include_functions=request.include_functions,
        )
        raw_nodes = expanded.get("nodes") or []
        raw_links = expanded.get("links") or []

        # Seeds are often functions; expand once more with functions visible if graph is empty
        if not raw_nodes and seed_ids and not request.include_functions:
            expanded = self.graph_engine.expand_subgraph(
                seed_ids,
                depth=request.depth,
                max_nodes=request.max_nodes,
                include_functions=True,
            )
            raw_nodes = expanded.get("nodes") or []
            raw_links = expanded.get("links") or []

        if not raw_nodes and q:
            logger.warning("Subgraph expansion empty after resolve; retrying keyword-only seeds")
            kw = _keyword_seeds(self.graph_engine, q, layer_hint, request.seed_k)
            kw_ids = self.graph_engine.resolve_node_ids([m.nodeId for m in kw])
            if kw_ids:
                seed_source = "keyword"
                matched = kw
                expanded = self.graph_engine.expand_subgraph(
                    kw_ids,
                    depth=request.depth,
                    max_nodes=request.max_nodes,
                    include_functions=True,
                )
                raw_nodes = expanded.get("nodes") or []
                raw_links = expanded.get("links") or []

        if not raw_nodes:
            elapsed = int((time.time() - t0) * 1000)
            return SubgraphResponse(
                query=q,
                layer=layer_hint,
                project=project,
                matched=matched[:10],
                meta=SubgraphMeta(
                    depth=request.depth,
                    maxNodes=request.max_nodes,
                    reason="no_matches",
                    elapsedMs=elapsed,
                    seedSource=seed_source,
                ),
            ).model_dump()

        if layer_hint:
            raw_nodes = [n for n in raw_nodes if infer_layer(n) == layer_hint]
            allowed = {n["id"] for n in raw_nodes if n.get("id")}
            raw_links = [
                l
                for l in raw_links
                if l.get("source") in allowed and l.get("target") in allowed
            ]

        teaching_nodes = [_raw_to_teaching_node(n) for n in raw_nodes if n.get("id")]
        node_ids = {n.id for n in teaching_nodes}
        teaching_edges: List[TeachingEdge] = []
        for link in raw_links:
            src = str(link.get("source", ""))
            tgt = str(link.get("target", ""))
            if src in node_ids and tgt in node_ids:
                teaching_edges.append(
                    TeachingEdge(
                        source=src,
                        target=tgt,
                        type=(link.get("relation") or link.get("type") or "depends_on").lower(),
                        weight=0.6,
                    )
                )

        truncated = len(raw_nodes) >= request.max_nodes
        elapsed = int((time.time() - t0) * 1000)
        visible_matched = [m for m in matched if m.nodeId in node_ids][:10]
        if not visible_matched:
            visible_matched = matched[:10]

        return SubgraphResponse(
            query=q,
            layer=layer_hint,
            project=project,
            nodes=teaching_nodes,
            edges=teaching_edges,
            layers=_build_layers(teaching_nodes),
            matched=visible_matched,
            meta=SubgraphMeta(
                depth=request.depth,
                maxNodes=request.max_nodes,
                truncated=truncated,
                nodeCount=len(teaching_nodes),
                edgeCount=len(teaching_edges),
                elapsedMs=elapsed,
                seedSource=seed_source,
            ),
        ).model_dump()
