import os
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


AUTH_RATE_LIMIT = int(os.getenv("AUTH_RATE_LIMIT", "10"))
AUTH_RATE_WINDOW_SECONDS = int(os.getenv("AUTH_RATE_WINDOW_SECONDS", "60"))


class RateLimiter:
    """Simple in-memory sliding-window limiter keyed by client IP.

    Suitable for a single-process deployment. Use a shared store
    such as Redis if the API is ever scaled to multiple workers.
    """

    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            hits = self._hits[key]

            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= self.limit:
                retry_after = int(hits[0] + self.window_seconds - now) + 1

                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )

            hits.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


auth_limiter = RateLimiter(
    limit=AUTH_RATE_LIMIT,
    window_seconds=AUTH_RATE_WINDOW_SECONDS,
)


def limit_auth_requests(request: Request) -> None:
    """FastAPI dependency that limits auth attempts per client IP."""
    client_ip = request.client.host if request.client else "unknown"
    auth_limiter.check(client_ip)
