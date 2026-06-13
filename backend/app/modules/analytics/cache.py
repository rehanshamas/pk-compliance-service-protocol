"""Redis cache for wallet risk scores. Risk-based TTL. Phase 6.2."""

import json
from uuid import UUID

from app.config import settings


CACHE_PREFIX = "analytics:score:"


def _cache_key(tenant_id: UUID, chain: str, address: str) -> str:
    return f"{CACHE_PREFIX}{tenant_id}:{chain.lower()}:{address.lower().strip()}"


def _ttl_for_score(score: int) -> int:
    """TTL in seconds. Severe/sanctioned returns 0 (no cache)."""
    if score >= 61:
        return settings.analytics_cache_ttl_high_seconds
    if score >= 21:
        return settings.analytics_cache_ttl_medium_seconds
    return settings.analytics_cache_ttl_low_seconds


async def get_cached_score(tenant_id: UUID, chain: str, address: str) -> dict | None:
    """Get cached score if present and not expired."""
    if not settings.analytics_cache_enabled:
        return None
    try:
        import redis.asyncio as redis
        r = redis.from_url(settings.redis_url)
        key = _cache_key(tenant_id, chain, address)
        data = await r.get(key)
        await r.aclose()
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def set_cached_score(
    tenant_id: UUID,
    chain: str,
    address: str,
    score_data: dict,
    score: int,
) -> None:
    """Cache score. Severe (90+) not cached per ARCHITECTURE."""
    if not settings.analytics_cache_enabled:
        return
    if score >= 90:
        return  # No cache for severe/sanctioned
    try:
        import redis.asyncio as redis
        r = redis.from_url(settings.redis_url)
        key = _cache_key(tenant_id, chain, address)
        ttl = _ttl_for_score(score)
        data = json.dumps(score_data)
        await r.setex(key, ttl, data)
        await r.aclose()
    except Exception:
        pass


async def invalidate_score(tenant_id: UUID, chain: str, address: str) -> None:
    """Invalidate cache on sanctions update or manual override."""
    try:
        import redis.asyncio as redis
        r = redis.from_url(settings.redis_url)
        key = _cache_key(tenant_id, chain, address)
        await r.delete(key)
        await r.aclose()
    except Exception:
        pass
