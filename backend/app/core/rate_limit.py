"""Redis-based per-tenant rate limiting middleware (sliding window counter)."""

import base64
import json
import time

import redis.asyncio as aioredis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

SKIP_PREFIXES = ("/health", "/docs", "/redoc", "/openapi")


def _extract_tenant_id_from_jwt(token: str) -> str | None:
    """Lightweight JWT payload extraction — no signature verification."""
    try:
        payload_b64 = token.split(".")[1]
        padding = 4 - len(payload_b64) % 4
        payload_b64 += "=" * padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("tenant_id")
    except Exception:
        return None


def _get_client_ip(request: Request) -> str:
    """Return the client IP, respecting X-Forwarded-For if present."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding window rate limiter backed by Redis."""

    def __init__(self, app):
        super().__init__(app)
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.redis_url, decode_responses=True
            )
        return self._redis

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting in test environment
        if settings.environment == "test":
            return await call_next(request)

        path = request.url.path
        if any(path.startswith(p) for p in SKIP_PREFIXES):
            return await call_next(request)

        # Determine bucket key and limit
        tenant_id = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            tenant_id = _extract_tenant_id_from_jwt(token)

        if tenant_id:
            bucket_key = f"tenant:{tenant_id}"
            limit = settings.rate_limit_per_minute
        else:
            client_ip = _get_client_ip(request)
            bucket_key = f"ip:{client_ip}"
            limit = settings.rate_limit_unauth_per_minute

        # Sliding window: current minute
        now = time.time()
        window = int(now // 60)
        redis_key = f"rate_limit:{bucket_key}:{window}"
        seconds_into_window = now - (window * 60)
        reset_seconds = int(60 - seconds_into_window)

        try:
            r = await self._get_redis()
            pipe = r.pipeline(transaction=True)
            pipe.incr(redis_key)
            pipe.expire(redis_key, 120)
            results = await pipe.execute()
            current_count = results[0]
        except Exception:
            # If Redis is unavailable, allow the request through
            return await call_next(request)

        remaining = max(0, limit - current_count)

        if current_count > limit:
            return JSONResponse(
                status_code=429,
                content={"status": "error", "error": {"code": "RATE_LIMITED", "message": "Too many requests"}},
                headers={
                    "Retry-After": str(reset_seconds),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_seconds),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_seconds)
        return response
