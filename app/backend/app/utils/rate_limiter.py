"""
In-memory sliding-window rate limiter.
"""

import os
import time
import threading
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, max_requests: int = 60, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._windows: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            dq = self._windows[key]
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= self.max_requests:
                return False
            dq.append(now)
            return True


_dev = os.getenv("ENVIRONMENT", "development").lower() == "development"
# Dev: dashboard polls graph + bridge via one proxy IP — needs a higher ceiling
general_limiter = RateLimiter(max_requests=600 if _dev else 120, window_seconds=60)
ingest_limiter = RateLimiter(max_requests=5, window_seconds=60)
query_limiter = RateLimiter(max_requests=30, window_seconds=60)
subgraph_limiter = RateLimiter(max_requests=20, window_seconds=60)
auth_limiter = RateLimiter(max_requests=10, window_seconds=60)
