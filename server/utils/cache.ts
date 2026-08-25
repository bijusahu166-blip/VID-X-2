import redis from "../config/redis";

const CACHE_TTL = {
  FEED: 30,
  TRENDING: 300,
  USER_PROFILE: 60,
  POST: 120,
  SEARCH: 300,
};

interface CacheOptions {
  ttl?: number;
  forceRefresh?: boolean;
}

function isRedisReady(): boolean {
  return Boolean(redis?.isReady);
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (!isRedisReady() || !redis) return null;

  try {
    const cached = await redis.get(key);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch (err) {
    console.warn("[Cache] Get error for key", key, err);
    return null;
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = CACHE_TTL.FEED
): Promise<void> {
  if (!isRedisReady() || !redis) return;

  try {
    await redis.setEx(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.warn("[Cache] Set error for key", key, err);
  }
}

export async function delCached(...keys: string[]): Promise<void> {
  if (!isRedisReady() || !redis || keys.length === 0) return;

  try {
    await redis.del(keys);
  } catch (err) {
    console.warn("[Cache] Delete error:", err);
  }
}

export async function delCachedPattern(pattern: string): Promise<void> {
  if (!isRedisReady() || !redis) return;

  try {
    const keys: string[] = [];

    for await (const key of redis.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      keys.push(String(key));

      if (keys.length >= 500) {
        await redis.del(keys.splice(0, keys.length));
      }
    }

    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (err) {
    console.warn("[Cache] Delete pattern error:", err);
  }
}

export async function getOrSet<T>(
  key: string,
  compute: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = CACHE_TTL.FEED, forceRefresh = false } = options;

  if (!forceRefresh) {
    const cached = await getCached<T>(key);
    if (cached !== null) return cached;
  }

  const value = await compute();
  await setCached(key, value, ttl);
  return value;
}

export const cacheKeys = {
  feed: (userId: string) => `feed:${userId}`,
  profile: (userId: string) => `profile:${userId}`,
  post: (postId: string) => `post:${postId}`,
  trending: () => "trending:all",
  userPosts: (userId: string) => `user:posts:${userId}`,
  comments: (postId: string) => `comments:${postId}`,
  followers: (userId: string) => `followers:${userId}`,
  following: (userId: string) => `following:${userId}`,
  search: (query: string) => `search:${query.toLowerCase()}`,
};

export async function invalidateUserCache(userId: string): Promise<void> {
  await delCached(
    cacheKeys.feed(userId),
    cacheKeys.profile(userId),
    cacheKeys.userPosts(userId),
    cacheKeys.followers(userId),
    cacheKeys.following(userId)
  );
}

export async function invalidatePostCache(
  postId: string,
  userId: string
): Promise<void> {
  await delCached(
    cacheKeys.post(postId),
    cacheKeys.comments(postId),
    cacheKeys.feed(userId),
    "trending:all"
  );
}

export async function getCachedBatch<T>(
  keys: string[]
): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  if (!isRedisReady() || !redis) return keys.map(() => null);

  try {
    const values = await redis.mGet(keys);
    return values.map((value: string | null) =>
      value ? (JSON.parse(value) as T) : null
    );
  } catch (err) {
    console.warn("[Cache] Batch get error:", err);
    return keys.map(() => null);
  }
}

export async function getCacheStats(): Promise<Record<string, any> | null> {
  if (!isRedisReady() || !redis) return null;

  try {
    const info = await redis.info("stats");
    const dbSize = await redis.dbSize();

    return {
      connected: true,
      info,
      dbSize,
    };
  } catch (err) {
    console.warn("[Cache] Stats error:", err);
    return null;
  }
}

export const CACHE_TTL_VALUES = CACHE_TTL;
