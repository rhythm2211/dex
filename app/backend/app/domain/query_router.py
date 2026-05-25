"""
GraphRAG query-intent router: classify queries to pick retrieval strategy.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional


class QueryIntent(str, Enum):
    SYMBOL_LOOKUP = "symbol_lookup"
    CALL_FLOW = "call_flow"
    ARCHITECTURE = "architecture"
    IMPACT = "impact"
    PERSON = "person"
    SEMANTIC = "semantic"


@dataclass
class RoutedQuery:
    intent: QueryIntent
    query: str
    node_names: List[str]
    person_name: Optional[str] = None
    k_vectors: int = 20
    graph_weight: float = 0.8
    sparse_weight: float = 1.0
    dense_weight: float = 1.0


_SYMBOL_PATTERNS = [
    r"\bwhere is (\w+) defined\b",
    r"\bfind (\w+)\b",
    r"\blocate (\w+)\b",
    r"\bdefinition of (\w+)\b",
]

_CALL_FLOW_KEYWORDS = [
    "call flow", "call chain", "calls", "called by", "trace", "path from",
    "flow through", "execution path", "data flow",
]

_ARCH_KEYWORDS = [
    "architecture", "architect", "structure", "design", "system", "component",
    "module", "dependency", "relationship", "overview", "explain the", "how does",
    "path to", "selected node", "layers",
]

_IMPACT_KEYWORDS = [
    "blast radius", "what breaks", "impact if", "affected by", "downstream",
    "upstream impact", "if we change", "if we remove", "ripple effect",
]

_PERSON_PATTERNS = [
    r"what (?:is|does|are) (.+?) (?:working on|doing|contributing)",
    r"who is (.+?)(?:\?|$|\s)",
    r"(.+?) (?:is|are) (?:working on|doing|contributing)",
    r"show (?:me )?(?:what|work) (.+?) (?:is|are) (?:working on|doing)",
]

_GENERAL_KEYWORDS = [
    "what is", "what does", "about this", "repo about", "repository about",
    "what is this", "explain this", "describe this", "overview",
    "this project", "project about", "codebase about", "about the project",
]


def extract_node_names(query: str) -> List[str]:
    names: List[str] = []
    for m in re.findall(r'["\']([^"\']+)["\']', query):
        if len(m.strip()) > 2:
            names.append(m.strip())
    for pat in _SYMBOL_PATTERNS:
        for m in re.findall(pat, query, re.I):
            if len(m) > 2:
                names.append(m)
    for m in re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*(?:_[a-zA-Z0-9_]+)+)\b", query):
        if len(m) > 5:
            names.append(m)
    seen: set = set()
    out: List[str] = []
    for n in names:
        k = n.lower()
        if k not in seen and k not in {"the", "selected", "node", "path", "to"}:
            seen.add(k)
            out.append(n)
    return out


def extract_person_name(query: str) -> Optional[str]:
    ql = query.lower()
    for pat in _PERSON_PATTERNS:
        m = re.search(pat, ql)
        if m:
            name = (m.group(1) or "").strip()
            if len(name) > 2 and not name.startswith("the "):
                return name
    return None


def route_query(query: str, k_vectors: int = 20) -> RoutedQuery:
    """Classify query intent and tune retrieval weights."""
    ql = query.lower()
    node_names = extract_node_names(query)
    person = extract_person_name(query)

    if person:
        return RoutedQuery(
            intent=QueryIntent.PERSON,
            query=query,
            node_names=node_names,
            person_name=person,
            k_vectors=max(k_vectors, 25),
            graph_weight=1.2,
            sparse_weight=0.5,
            dense_weight=0.5,
        )

    if any(kw in ql for kw in _IMPACT_KEYWORDS):
        return RoutedQuery(
            intent=QueryIntent.IMPACT,
            query=query,
            node_names=node_names,
            k_vectors=max(k_vectors, 25),
            graph_weight=1.5,
            sparse_weight=0.6,
            dense_weight=0.6,
        )

    if node_names or any(p in ql for p in ("where is", "defined", "find reference", "go to")):
        return RoutedQuery(
            intent=QueryIntent.SYMBOL_LOOKUP,
            query=query,
            node_names=node_names,
            k_vectors=max(k_vectors, 20),
            graph_weight=1.3,
            sparse_weight=1.2,
            dense_weight=0.8,
        )

    if any(kw in ql for kw in _CALL_FLOW_KEYWORDS):
        return RoutedQuery(
            intent=QueryIntent.CALL_FLOW,
            query=query,
            node_names=node_names,
            k_vectors=max(k_vectors, 30),
            graph_weight=1.4,
            sparse_weight=0.8,
            dense_weight=0.9,
        )

    if any(kw in ql for kw in _ARCH_KEYWORDS):
        return RoutedQuery(
            intent=QueryIntent.ARCHITECTURE,
            query=query,
            node_names=node_names,
            k_vectors=max(k_vectors, 30),
            graph_weight=1.2,
            sparse_weight=0.7,
            dense_weight=1.0,
        )

    if any(kw in ql for kw in _GENERAL_KEYWORDS):
        return RoutedQuery(
            intent=QueryIntent.SEMANTIC,
            query=query,
            node_names=node_names,
            k_vectors=max(k_vectors, 40),
            graph_weight=0.9,
            sparse_weight=1.0,
            dense_weight=1.0,
        )

    return RoutedQuery(
        intent=QueryIntent.SEMANTIC,
        query=query,
        node_names=node_names,
        k_vectors=k_vectors,
        graph_weight=0.8,
        sparse_weight=1.0,
        dense_weight=1.0,
    )
