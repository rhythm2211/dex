"""
Query telemetry for retrieval tuning and monitoring.
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("dex-core")

TELEMETRY_DIR = os.getenv("DEX_TELEMETRY_DIR", "")


@dataclass
class QueryTelemetry:
    user_id: str
    query: str
    intent: str = "semantic"
    dense_count: int = 0
    sparse_count: int = 0
    graph_count: int = 0
    final_chunk_count: int = 0
    citation_passed: bool = True
    latency_ms: float = 0.0
    retrieval_ms: float = 0.0
    llm_ms: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    extra: Dict[str, Any] = field(default_factory=dict)


def _telemetry_path(user_id: str) -> Path:
    base = Path(TELEMETRY_DIR) if TELEMETRY_DIR else Path(__file__).resolve().parents[2] / "data" / "telemetry"
    base.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in user_id)
    return base / f"{safe}_queries.jsonl"


def log_query_event(event: QueryTelemetry) -> None:
    try:
        path = _telemetry_path(event.user_id)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(event), default=str) + "\n")
    except Exception as e:
        logger.debug(f"Telemetry write failed: {e}")


class QueryTimer:
    def __init__(self):
        self._t0 = time.perf_counter()
        self.retrieval_ms = 0.0
        self.llm_ms = 0.0

    def mark_retrieval_done(self):
        self.retrieval_ms = (time.perf_counter() - self._t0) * 1000

    def mark_llm_done(self):
        self.llm_ms = (time.perf_counter() - self._t0) * 1000 - self.retrieval_ms

    @property
    def total_ms(self) -> float:
        return (time.perf_counter() - self._t0) * 1000
