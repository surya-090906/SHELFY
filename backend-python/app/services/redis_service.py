import time
import json
import logging
from typing import Optional, Any
from app.config import settings

logger = logging.getLogger(__name__)

# Try connecting to Redis, otherwise provide robust in-memory caching
_redis_client = None
_in_memory_cache = {}
_in_memory_expiry = {}


def get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    try:
        import redis
        client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        client.ping()
        _redis_client = client
        logger.info("Connected to Redis server.")
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis not available locally ({e}). Using robust in-memory cache/rate-limiter.")
        return None


class CacheService:
    @staticmethod
    def get(key: str) -> Optional[str]:
        client = get_redis()
        if client:
            try:
                return client.get(key)
            except Exception:
                pass

        # In-memory fallback
        if key in _in_memory_cache:
            if key in _in_memory_expiry and time.time() > _in_memory_expiry[key]:
                del _in_memory_cache[key]
                del _in_memory_expiry[key]
                return None
            return _in_memory_cache.get(key)
        return None

    @staticmethod
    def set(key: str, value: str, ex: Optional[int] = None):
        client = get_redis()
        if client:
            try:
                client.set(key, value, ex=ex)
                return
            except Exception:
                pass

        _in_memory_cache[key] = value
        if ex:
            _in_memory_expiry[key] = time.time() + ex

    @staticmethod
    def delete(key: str):
        client = get_redis()
        if client:
            try:
                client.delete(key)
                return
            except Exception:
                pass

        _in_memory_cache.pop(key, None)
        _in_memory_expiry.pop(key, None)

    @staticmethod
    def delete_prefix(prefix: str):
        client = get_redis()
        if client:
            try:
                keys = client.keys(f"{prefix}*")
                if keys:
                    client.delete(*keys)
                return
            except Exception:
                pass

        keys_to_del = [k for k in _in_memory_cache if k.startswith(prefix)]
        for k in keys_to_del:
            _in_memory_cache.pop(k, None)
            _in_memory_expiry.pop(k, None)

    @staticmethod
    def check_rate_limit(key: str, max_attempts: int = 3, window_seconds: int = 900) -> bool:
        """
        Enforces rate limiting. Returns True if request is allowed, False if exceeded.
        """
        current_val = CacheService.get(key)
        attempts = int(current_val) if current_val else 0

        if attempts >= max_attempts:
            return False

        CacheService.set(key, str(attempts + 1), ex=window_seconds)
        return True


cache = CacheService()
