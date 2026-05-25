"""
Function-aware contextual chunking for code embeddings.

Each chunk aligns to a semantic unit (class or function) with structural metadata,
dramatically improving RAG retrieval vs character-count splitting.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

DEFAULT_MAX_CHUNK_CHARS = 2000
OVERLAP_CHARS = 150


def _lines(content: str) -> List[str]:
    return content.splitlines()


def _slice_lines(lines: List[str], start_line: int, end_line: int) -> str:
    """1-indexed inclusive line range."""
    if start_line < 1:
        start_line = 1
    if end_line > len(lines):
        end_line = len(lines)
    if start_line > end_line or not lines:
        return ""
    return "\n".join(lines[start_line - 1 : end_line])


def _parent_class_name(node_id: str, file_path: str) -> Optional[str]:
    """Extract class name from id like 'path/file.ts::ClassName::method'."""
    if "::" not in node_id:
        return None
    parts = node_id.split("::")
    if len(parts) >= 2 and parts[0] == file_path:
        return parts[1]
    if len(parts) >= 2:
        return parts[-2] if len(parts) > 2 else None
    return None


def _build_header(file_path: str, node: dict) -> str:
    parts = [f"File: {file_path}"]
    node_type = node.get("type", "")
    name = node.get("name", "")

    if node_type == "class":
        parts.append(f"Class: {name}")
    elif node_type == "function":
        class_name = _parent_class_name(node.get("id", ""), file_path)
        if class_name and not class_name.endswith((".py", ".ts", ".js", ".go", ".java", ".rs", ".rb")):
            parts.append(f"Class: {class_name}")
        parts.append(f"Function: {name}")

    return "\n".join(parts)


def _split_large_body(header: str, body: str, max_chars: int) -> List[str]:
    """Split oversized bodies while keeping header on every sub-chunk."""
    budget = max_chars - len(header) - 2
    if budget < 200:
        budget = max_chars // 2
    if len(body) <= budget:
        return [f"{header}\n{body}"]

    chunks: List[str] = []
    start = 0
    while start < len(body):
        end = start + budget
        if end < len(body):
            # Prefer breaking at newline
            nl = body.rfind("\n", start, end)
            if nl > start + budget // 2:
                end = nl + 1
        piece = body[start:end].strip()
        if piece:
            part_label = f" (part {len(chunks) + 1})" if start > 0 or end < len(body) else ""
            chunks.append(f"{header}{part_label}\n{piece}")
        start = end - OVERLAP_CHARS if end < len(body) else len(body)
    return chunks or [f"{header}\n{body[:budget]}"]


def build_contextual_chunks(
    file_path: str,
    content: str,
    structure_nodes: List[dict],
    max_chunk_chars: int = DEFAULT_MAX_CHUNK_CHARS,
) -> List[Dict[str, Any]]:
    """
    Build embedding chunks from extracted structure.

    Args:
        file_path: Relative path used in metadata
        content: Full file source
        structure_nodes: Nodes from graph extraction (includes file node)
        max_chunk_chars: Soft max per chunk; large functions are sub-split

    Returns:
        List of dicts with keys: page_content, metadata (start_line, end_line, chunk_type, symbol_name)
    """
    lines = _lines(content)
    structural = [
        n
        for n in structure_nodes
        if n.get("type") in ("class", "function") and "start_line" in n and "end_line" in n
    ]
    if not structural:
        return []

    # Sort by start line; prefer functions over enclosing classes at same region
    structural.sort(key=lambda n: (n["start_line"], 0 if n["type"] == "function" else 1))

    covered_lines: set[int] = set()
    chunks: List[Dict[str, Any]] = []

    for node in structural:
        start = node["start_line"]
        end = node["end_line"]
        body = _slice_lines(lines, start, end)
        if not body.strip():
            continue

        header = _build_header(file_path, node)
        for text in _split_large_body(header, body, max_chunk_chars):
            chunks.append(
                {
                    "page_content": text,
                    "metadata": {
                        "source": file_path,
                        "file_name": file_path,
                        "start_line": start,
                        "end_line": end,
                        "chunk_type": node["type"],
                        "symbol_name": node.get("name", ""),
                        "symbol_id": node.get("id", ""),
                        "chunking": "contextual",
                    },
                }
            )
        for ln in range(start, end + 1):
            covered_lines.add(ln)

    # Module-level preamble (imports, constants) not inside any symbol
    if lines:
        uncovered: List[str] = []
        for i, line in enumerate(lines, 1):
            if i not in covered_lines:
                uncovered.append(line)
        preamble = "\n".join(uncovered).strip()
        if preamble and len(preamble) > 20:
            header = f"File: {file_path}\nModule: top-level"
            for text in _split_large_body(header, preamble, max_chunk_chars):
                chunks.append(
                    {
                        "page_content": text,
                        "metadata": {
                            "source": file_path,
                            "file_name": file_path,
                            "chunk_type": "module",
                            "chunking": "contextual",
                        },
                    }
                )

    return chunks


def build_manifest_chunks(file_path: str, content: str, max_chunk_chars: int = DEFAULT_MAX_CHUNK_CHARS) -> List[Dict[str, Any]]:
    """Single manifest chunk with structural header for config/infrastructure files."""
    basename = os.path.basename(file_path)
    header = f"File: {file_path}\nManifest: {basename}"
    body = content.strip()
    if not body:
        return []
    if len(header) + len(body) + 2 <= max_chunk_chars:
        text = f"{header}\n{body}"
        return [{
            "page_content": text,
            "metadata": {
                "source": file_path,
                "file_name": file_path,
                "chunk_type": "manifest",
                "symbol_name": basename,
                "chunking": "contextual",
            },
        }]
    return [
        {
            "page_content": text,
            "metadata": {
                "source": file_path,
                "file_name": file_path,
                "chunk_type": "manifest",
                "symbol_name": basename,
                "chunking": "contextual",
            },
        }
        for text in _split_large_body(header, body, max_chunk_chars)
    ]


def chunk_stats(chunks: List[Dict[str, Any]]) -> dict:
    """Summary stats for logging / impact metrics."""
    by_type: Dict[str, int] = {}
    for c in chunks:
        t = c.get("metadata", {}).get("chunk_type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
    return {"total": len(chunks), "by_type": by_type}
