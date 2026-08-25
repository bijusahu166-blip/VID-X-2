import { createClient, type RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL;

let redis: RedisClientType | null = null;

if (redisUrl) {
  redis = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    },
  });

  redis.on("connect", () => {
    console.log("[Redis] Connecting...");
  });

  redis.on("ready", () => {
    console.log("[Redis] Connected to Redis cache");
  });

  redis.on("reconnecting", () => {
    console.log("[Redis] Reconnecting to Redis...");
  });

  redis.on("error", (err: Error) => {
    console.warn("[Redis] Connection error (will use fallback):", err.message);
  });

  // Connect without crashing the app if Redis is temporarily unavailable.
  void redis.connect().catch((err: Error) => {
    console.warn("[Redis] Initial connection failed (cache disabled until reconnect):", err.message);
  });

  const shutdownRedis = async () => {
    if (!redis) return;

    try {
      if (redis.isOpen) {
        await redis.quit();
      }
      console.log("[Redis] Disconnected gracefully");
    } catch (err) {
      console.error("[Redis] Error during shutdown:", err);
    }
  };

  process.once("SIGTERM", shutdownRedis);
  process.once("SIGINT", shutdownRedis);
} else {
  console.warn("[Redis] REDIS_URL not set - Redis cache is disabled");
}

export default redis;