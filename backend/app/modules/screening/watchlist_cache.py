"""Redis-backed watchlist cache for high-performance screening."""

import json
import time
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.screening import WatchlistEntry

CACHE_KEY = "watchlist:entries"
CACHE_VERSION_KEY = "watchlist:version"


class WatchlistCache:
    """Caches watchlist entries in Redis for O(1) lookup per screening request."""

    def __init__(self):
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        return self._redis

    async def refresh(self, db: AsyncSession) -> int:
        """Reload all watchlist entries from DB into Redis. Returns entry count."""
        result = await db.execute(select(WatchlistEntry))
        entries = result.scalars().all()

        r = await self._get_redis()
        pipe = r.pipeline(transaction=True)
        pipe.delete(CACHE_KEY)

        for entry in entries:
            entry_data = {
                "id": str(entry.id),
                "source": entry.source.value,
                "entity_type": entry.entity_type.value,
                "primary_name": entry.primary_name,
                "aliases": entry.aliases or [],
                "dob": entry.dob,
                "nationality": entry.nationality,
                "id_numbers": entry.id_numbers or [],
                "crypto_addresses": entry.crypto_addresses or [],
            }
            pipe.rpush(CACHE_KEY, json.dumps(entry_data))

        pipe.set(CACHE_VERSION_KEY, str(int(time.time())))
        await pipe.execute()
        return len(entries)

    async def get_all(self) -> list[dict]:
        """Get all cached watchlist entries. Falls back to empty if cache miss."""
        r = await self._get_redis()
        raw_entries = await r.lrange(CACHE_KEY, 0, -1)
        return [json.loads(e) for e in raw_entries]

    async def is_stale(self, max_age_seconds: int = 86400) -> bool:
        """Check if cache is older than max_age_seconds."""
        r = await self._get_redis()
        version = await r.get(CACHE_VERSION_KEY)
        if not version:
            return True
        return (time.time() - int(version)) > max_age_seconds


watchlist_cache = WatchlistCache()
