"""
Heading-aware markdown/documentation chunking for RAG ingestion.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

DEFAULT_MAX_TOKENS = 500
CHARS_PER_TOKEN = 4
DEFAULT_MAX_CHARS = DEFAULT_MAX_TOKENS * CHARS_PER_TOKEN
OVERLAP_RATIO = 0.5


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // CHARS_PER_TOKEN)


def _split_heading_sections(content: str) -> List[tuple[str, str]]:
    """Split markdown by headings; returns (heading_path, body) pairs."""
    lines = content.splitlines()
    sections: List[tuple[str, str]] = []
    current_heading = ""
    current_lines: List[str] = []

    heading_re = re.compile(r"^(#{1,6})\s+(.+)$")

    def flush():
        nonlocal current_lines, current_heading
        body = "\n".join(current_lines).strip()
        if body or current_heading:
            sections.append((current_heading or "Introduction", body))
        current_lines = []

    for line in lines:
        m = heading_re.match(line)
        if m:
            flush()
            level = len(m.group(1))
            title = m.group(2).strip()
            current_heading = title
            current_lines = [line]
        else:
            current_lines.append(line)
    flush()
    return sections if sections else [("Document", content)]


def chunk_markdown(
    content: str,
    file_path: str,
    *,
    max_chars: int = DEFAULT_MAX_CHARS,
    overlap_ratio: float = OVERLAP_RATIO,
) -> List[Dict[str, Any]]:
    """
    Chunk markdown by headings with overlap. Returns list of dicts with content + metadata.
    """
    sections = _split_heading_sections(content)
    chunks: List[Dict[str, Any]] = []
    overlap = int(max_chars * overlap_ratio)

    for heading_path, body in sections:
        if not body.strip():
            continue
        header = f"File: {file_path}\nDoc: {heading_path}\n"
        text = body
        start = 0
        part = 0
        while start < len(text):
            end = start + max_chars - len(header)
            if end < len(text):
                nl = text.rfind("\n", start, end)
                if nl > start + max_chars // 3:
                    end = nl + 1
            piece = text[start:end].strip()
            if piece:
                part += 1
                suffix = f" (part {part})" if part > 1 or end < len(text) else ""
                chunk_content = f"{header}{suffix}\n{piece}"
                chunks.append({
                    "page_content": chunk_content,
                    "metadata": {
                        "file_name": file_path,
                        "source": file_path,
                        "chunk_type": "documentation",
                        "doc_type": "markdown",
                        "heading_path": heading_path + suffix,
                        "symbol_name": heading_path,
                    },
                })
            if end >= len(text):
                break
            start = max(start + 1, end - overlap)

    return chunks
