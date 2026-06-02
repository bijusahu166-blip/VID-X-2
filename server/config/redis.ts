import Redis from 'ioredis';

// Use REDIS_URL from environment (required for production)
// In development, can be set to redis://localhost:6379
const redisUrl = process.env.REDIS_URL;

import Redis from 'ioredis';

// Use REDIS_URL from environment (required for production)
// In development, can be set to redis://localhost:6379
const redisUrl = process.env.REDIS_URL;

const redis = redisUrl ? new Redis(redisUrl, {
  enableReadyCheck: false,
  enableOfflineQueue: true,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: null,
}) : null;

if (redis) {
  redis.on('connect', () => {
    console.log('[Redis] Connected to Redis cache');
  });

  redis.on('error', (err) => {
    console.warn('[Redis] Connection error (will use fallback):', err.message);
  });

  redis.on('reconnecting', () => {
    console.log('[Redis] Reconnecting to Redis...');
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    try {
      await redis.quit();
      console.log('[Redis] Disconnected gracefully');
    } catch (err) {
      console.error('[Redis] Error during shutdown:', err);
    }
  });
} else {
  console.warn('[Redis] REDIS_URL not set - Redis cache is disabled');
}

export default redis;
