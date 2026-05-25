"""
Post-generation citation verification for grounded RAG answers.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Set, Tuple


_CITATION_PATTERNS = [
    re.compile(r"`([^`]+\.(?:py|ts|tsx|js|jsx|go|java|rs|rb|md|yaml|yml|json|txt))(?::(\d+(?:-\d+)?))?`"),
    re.compile(r"\b([\w./\\-]+\.(?:py|ts|tsx|js|jsx|go|java|rs|rb|md)):(\d+)\b"),
    re.compile(r"\(([\w./\\-]+\.(?:py|ts|tsx|js|jsx|go|java|rs|rb|md))\)"),
]

_SYMBOL_PATTERN = re.compile(r"\b([A-Z][a-zA-Z0-9_]*|[a-z_][a-z0-9_]{3,})\b")


@dataclass
class CitationCheckResult:
    passed: bool
    citations_found: List[str] = field(default_factory=list)
    citations_verified: List[str] = field(default_factory=list)
    citations_failed: List[str] = field(default_factory=list)
    ungrounded_symbols: List[str] = field(default_factory=list)


def extract_citations(answer: str) -> List[str]:
    cites: List[str] = []
    for pat in _CITATION_PATTERNS:
        for m in pat.finditer(answer):
            path = m.group(1).replace("\\", "/")
            line = m.group(2) if m.lastindex and m.lastindex >= 2 else ""
            cites.append(f"{path}:{line}" if line else path)
    return list(dict.fromkeys(cites))


def verify_citations(
    answer: str,
    code_context: str,
    graph_context: str,
) -> CitationCheckResult:
    """Verify cited paths appear in retrieved context."""
    combined = (code_context or "") + "\n" + (graph_context or "")
    combined_lower = combined.lower()
    cites = extract_citations(answer)

    verified: List[str] = []
    failed: List[str] = []
    for c in cites:
        path = c.split(":")[0].lower()
        if path in combined_lower or path.split("/")[-1] in combined_lower:
            verified.append(c)
        else:
            failed.append(c)

    passed = len(failed) == 0 or (len(verified) > 0 and len(failed) <= len(verified))

    return CitationCheckResult(
        passed=passed,
        citations_found=cites,
        citations_verified=verified,
        citations_failed=failed,
    )


def extract_claimed_symbols(answer: str) -> Set[str]:
    """Heuristic: capitalized identifiers and snake_case function-like tokens."""
    skip = {
        "the", "this", "that", "when", "where", "what", "how", "file", "class",
        "function", "module", "import", "return", "true", "false", "none", "null",
    }
    out: Set[str] = set()
    for m in _SYMBOL_PATTERN.finditer(answer):
        s = m.group(1)
        if s.lower() not in skip and len(s) > 3:
            out.add(s)
    return out


def check_symbols_in_context(answer: str, code_context: str, graph_context: str) -> List[str]:
    """Return symbols mentioned in answer but absent from context (hallucination proxy)."""
    combined = (code_context or "") + "\n" + (graph_context or "")
    ungrounded: List[str] = []
    for sym in extract_claimed_symbols(answer):
        if sym not in combined and sym.lower() not in combined.lower():
            ungrounded.append(sym)
    return ungrounded[:20]
