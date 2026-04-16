from redis.asyncio import Redis
from redis.asyncio import from_url
from .config import settings
from typing import Optional, Any

redis_pool: Redis | None = None

async def connect_redis():
    """Create Redis connection pool."""
    global redis_pool
    try:
        redis_pool = from_url(
            str(settings.REDIS_URL),
            encoding="utf-8",
            decode_responses=True
        )
        await redis_pool.ping()
        print("Redis connection successful.")
    except Exception as e:
        print(f"Redis connection failed: {e}")

async def disconnect_redis():
    """Close Redis connection pool."""
    if redis_pool:
        await redis_pool.close()
        print("Redis connection closed.")

def get_redis_pool() -> Redis:
    """Get the Redis connection pool."""
    if redis_pool is None:
        raise RuntimeError("Redis pool not initialized. Call connect_redis() first.")
    return redis_pool

async def get_redis() -> Redis:
    """Dependency function to get a Redis connection."""
    return get_redis_pool()

async def set_value(key: str, value: Any, ttl: Optional[int] = None):
    """Set a value in Redis with an optional TTL in seconds."""
    redis = get_redis_pool()
    await redis.set(key, value, ex=ttl)

async def get_value(key: str) -> Optional[str]:
    """Get a value from Redis."""
    redis = get_redis_pool()
    return await redis.get(key)

async def delete_value(key: str):
    """Delete a value from Redis."""
    redis = get_redis_pool()
    await redis.delete(key)
