"""
Simple TTL in-memory cache for expensive read-only endpoints.
"""

import time
import threading
from typing import Any, Optional


class TTLCache:
    """Thread-safe TTL cache with optional per-key override."""

    def __init__(self, ttl_seconds: float = 300.0, max_size: int = 512):
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        expires_at = time.monotonic() + (ttl if ttl is not None else self.ttl_seconds)
        with self._lock:
            if len(self._store) >= self.max_size and key not in self._store:
                oldest = min(self._store.items(), key=lambda x: x[1][1])
                del self._store[oldest[0]]
            self._store[key] = (value, expires_at)

    def invalidate_prefix(self, prefix: str) -> int:
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
            return len(keys)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


graph_cache = TTLCache(ttl_seconds=120, max_size=256)
health_cache = TTLCache(ttl_seconds=60, max_size=128)
team_cache = TTLCache(ttl_seconds=180, max_size=128)
