"""
SCIP indexer integration: compiler-accurate cross-file symbols, CALLS, REFERENCES.
Falls back gracefully when SCIP CLI tools are not installed.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("dex-core")

SCIP_INDEXERS: Dict[str, List[str]] = {
    "typescript": ["scip-typescript", "npx", "@sourcegraph/scip-typescript"],
    "javascript": ["scip-typescript", "npx", "@sourcegraph/scip-typescript"],
    "python": ["scip-python"],
    "go": ["scip-go"],
    "java": ["scip-java"],
}


@dataclass
class ScipSymbol:
    symbol_id: str
    name: str
    kind: str
    file_path: str
    line: int = 0


@dataclass
class ScipEdge:
    source_id: str
    target_id: str
    relation: str  # CALLS, REFERENCES, DEFINES, IMPLEMENTS


@dataclass
class ScipIndexResult:
    symbols: List[ScipSymbol] = field(default_factory=list)
    edges: List[ScipEdge] = field(default_factory=list)
    language: str = ""
    scip_path: Optional[str] = None


def _find_scip_cli(lang: str) -> Optional[List[str]]:
    """Return command prefix to run SCIP indexer for language, or None."""
    candidates = SCIP_INDEXERS.get(lang, [])
    for i in range(0, len(candidates), 2 if len(candidates) > 1 else 1):
        cmd = candidates[i] if isinstance(candidates[i], str) else candidates[i]
        if shutil.which(cmd):
            return [cmd]
        if cmd == "npx" and i + 1 < len(candidates):
            return ["npx", "--yes", candidates[i + 1]]
    return None


def run_scip_index(repo_root: str, language: str) -> ScipIndexResult:
    """
    Run SCIP indexer subprocess for repo_root. Returns parsed symbols/edges.
    """
    result = ScipIndexResult(language=language)
    cmd_prefix = _find_scip_cli(language)
    if not cmd_prefix:
        logger.debug("SCIP indexer not found for %s", language)
        return result

    out_dir = tempfile.mkdtemp(prefix="dex-scip-")
    scip_file = os.path.join(out_dir, "index.scip")

    try:
        if language in ("typescript", "javascript"):
            full_cmd = cmd_prefix + ["index", repo_root, "--output", scip_file]
        elif language == "python":
            full_cmd = cmd_prefix + ["index", repo_root, scip_file]
        elif language == "go":
            full_cmd = cmd_prefix + ["index", repo_root, scip_file]
        elif language == "java":
            full_cmd = cmd_prefix + ["index", repo_root, scip_file]
        else:
            return result

        proc = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            timeout=int(os.getenv("SCIP_INDEX_TIMEOUT", "600")),
            cwd=repo_root,
        )
        if proc.returncode != 0:
            logger.warning("SCIP index failed (%s): %s", language, proc.stderr[:500])
            return result

        if not os.path.isfile(scip_file):
            return result

        result.scip_path = scip_file
        symbols, edges = _parse_scip_json(scip_file, repo_root, language)
        result.symbols = symbols
        result.edges = edges
        logger.info("SCIP %s: %d symbols, %d edges", language, len(symbols), len(edges))
    except subprocess.TimeoutExpired:
        logger.warning("SCIP index timed out for %s", language)
    except Exception as e:
        logger.warning("SCIP index error (%s): %s", language, e)
    return result


def _parse_scip_json(scip_path: str, repo_root: str, language: str) -> Tuple[List[ScipSymbol], List[ScipEdge]]:
    """
    Parse SCIP index via `scip print --json` if available, else minimal protobuf-less stub.
    """
    symbols: List[ScipSymbol] = []
    edges: List[ScipEdge] = []

    scip_print = shutil.which("scip")
    json_path = scip_path + ".json"
    if scip_print:
        try:
            subprocess.run(
                [scip_print, "print", "--json", scip_path],
                capture_output=True,
                text=True,
                timeout=120,
                check=True,
            )
        except Exception:
            pass

    if os.path.isfile(json_path):
        try:
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            return _scip_json_to_graph(data, repo_root)
        except Exception as e:
            logger.debug("SCIP JSON parse failed: %s", e)

    # Minimal fallback: treat .scip as indexed marker only
    return symbols, edges


def _scip_json_to_graph(data: dict, repo_root: str) -> Tuple[List[ScipSymbol], List[ScipEdge]]:
    symbols: List[ScipSymbol] = []
    edges: List[ScipEdge] = []
    repo_root = repo_root.replace("\\", "/")

    for doc in data.get("documents", []) or []:
        rel_path = (doc.get("relativePath") or "").replace("\\", "/")
        for occ in doc.get("occurrences", []) or []:
            sym = occ.get("symbol", "")
            if not sym:
                continue
            name = sym.split("/")[-1] if "/" in sym else sym
            line = 0
            rng = occ.get("range")
            if rng and len(rng) >= 1:
                line = int(rng[0]) + 1
            symbols.append(
                ScipSymbol(
                    symbol_id=sym,
                    name=name,
                    kind=occ.get("symbolRoles", ["reference"])[0] if isinstance(occ.get("symbolRoles"), list) else "symbol",
                    file_path=rel_path,
                    line=line,
                )
            )

    for edge in data.get("externalSymbols", []) or []:
        pass  # external package refs — optional

    # Relationship extraction from symbol graph when present
    for rel in data.get("relationships", []) or []:
        src = rel.get("source", "")
        tgt = rel.get("target", "")
        rtype = (rel.get("type") or "REFERENCES").upper()
        if src and tgt:
            edges.append(ScipEdge(source_id=src, target_id=tgt, relation=rtype))

    return symbols, edges


def merge_scip_into_graph_engine(graph_engine, scip_result: ScipIndexResult, user_id: str) -> int:
    """
    Write SCIP symbols/edges into Neo4j via graph_engine driver.
    Returns count of edges written.
    """
    if not scip_result.edges and not scip_result.symbols:
        return 0

    driver = getattr(graph_engine, "driver", None)
    if not driver:
        return 0

    count = 0
    db = getattr(graph_engine, "database", "neo4j")

    with driver.session(database=db) as session:
        for sym in scip_result.symbols:
            node_id = f"{sym.file_path}::{sym.name}" if sym.name else sym.file_path
            session.run(
                """
                MERGE (n:CodeNode {id: $id, user_id: $user_id})
                SET n.name = $name, n.type = $type, n.scip_symbol_id = $scip_id,
                    n.file_path = $file_path, n.start_line = $line
                """,
                id=node_id,
                user_id=user_id,
                name=sym.name,
                type="function",
                scip_id=sym.symbol_id,
                file_path=sym.file_path,
                line=sym.line,
            )

        for edge in scip_result.edges:
            session.run(
                """
                MATCH (a:CodeNode {scip_symbol_id: $src, user_id: $user_id})
                MATCH (b:CodeNode {scip_symbol_id: $tgt, user_id: $user_id})
                MERGE (a)-[r:REFERENCES {user_id: $user_id}]->(b)
                SET r.relation = $rel
                """,
                src=edge.source_id,
                tgt=edge.target_id,
                user_id=user_id,
                rel=edge.relation,
            )
            count += 1

    return count


def detect_repo_languages(repo_root: str) -> List[str]:
    """Heuristic language detection for SCIP indexing."""
    langs: set = set()
    root = Path(repo_root)
    exts = {
        ".ts": "typescript",
        ".tsx": "typescript",
        ".js": "javascript",
        ".jsx": "javascript",
        ".py": "python",
        ".go": "go",
        ".java": "java",
    }
    for p in root.rglob("*"):
        if p.is_file() and p.suffix in exts:
            langs.add(exts[p.suffix])
        if len(langs) >= 4:
            break
    return list(langs)


def index_repo_with_scip(repo_root: str, user_id: str, graph_engine) -> Dict[str, Any]:
    """Run SCIP for all detected languages and merge into graph."""
    summary: Dict[str, Any] = {"languages": {}, "total_edges": 0}
    for lang in detect_repo_languages(repo_root):
        res = run_scip_index(repo_root, lang)
        n = merge_scip_into_graph_engine(graph_engine, res, user_id)
        summary["languages"][lang] = {
            "symbols": len(res.symbols),
            "edges": n,
            "scip_available": res.scip_path is not None,
        }
        summary["total_edges"] += n
    return summary
