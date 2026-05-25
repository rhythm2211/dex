"""Central ingest speed/quality toggles (env-driven)."""
from __future__ import annotations

import os


def _truthy(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).lower() in ("1", "true", "yes", "on")


def ingest_fast_mode() -> bool:
    """Skip expensive git blame / SCIP / deep history when speed matters."""
    return _truthy("INGEST_FAST_MODE", "1")


def ingest_shallow_clone() -> bool:
    if os.getenv("INGEST_SHALLOW_CLONE", "").lower() in ("0", "false", "no", "off"):
        return False
    if os.getenv("INGEST_SHALLOW_CLONE", "").lower() in ("1", "true", "yes", "on"):
        return True
    return ingest_fast_mode()


def ingest_skip_git_blame() -> bool:
    if os.getenv("INGEST_SKIP_GIT_BLAME", "").lower() in ("0", "false", "no", "off"):
        return False
    if os.getenv("INGEST_SKIP_GIT_BLAME", "").lower() in ("1", "true", "yes", "on"):
        return True
    return ingest_fast_mode()


def ingest_skip_scip() -> bool:
    if os.getenv("INGEST_SKIP_SCIP", "").lower() in ("0", "false", "no", "off"):
        return False
    if os.getenv("INGEST_SKIP_SCIP", "").lower() in ("1", "true", "yes", "on"):
        return True
    return ingest_fast_mode()


def ingest_skip_architecture() -> bool:
    if os.getenv("INGEST_SKIP_ARCHITECTURE", "").lower() in ("0", "false", "no", "off"):
        return False
    if os.getenv("INGEST_SKIP_ARCHITECTURE", "").lower() in ("1", "true", "yes", "on"):
        return True
    return ingest_fast_mode()


def ingest_git_commits_per_branch() -> int:
    default = "20" if ingest_fast_mode() else "80"
    try:
        return max(5, int(os.getenv("INGEST_GIT_COMMITS_PER_BRANCH", default)))
    except ValueError:
        return 20 if ingest_fast_mode() else 80


def ingest_max_git_branches() -> int:
    default = "1" if ingest_fast_mode() else "12"
    try:
        return max(1, int(os.getenv("INGEST_MAX_GIT_BRANCHES", default)))
    except ValueError:
        return 1 if ingest_fast_mode() else 12


def ingest_doc_max_chars() -> int:
    """Larger chunks => fewer Voyage API calls on markdown-heavy repos."""
    default = "3200" if ingest_fast_mode() else "2000"
    try:
        return max(800, int(os.getenv("INGEST_DOC_MAX_CHARS", default)))
    except ValueError:
        return 3200 if ingest_fast_mode() else 2000


def ingest_neo4j_file_batch_size() -> int:
    default = "100" if ingest_fast_mode() else "50"
    try:
        return max(10, int(os.getenv("INGEST_NEO4J_BATCH_SIZE", default)))
    except ValueError:
        return 100 if ingest_fast_mode() else 50
