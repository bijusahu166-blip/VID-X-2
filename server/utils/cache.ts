import redis from '../config/redis';

const CACHE_TTL = {
  FEED: 30, // 30 seconds - frequently changing
  TRENDING: 300, // 5 minutes
  USER_PROFILE: 60, // 1 minute
  POST: 120, // 2 minutes
  SEARCH: 300, // 5 minutes
};

interface CacheOptions {
  ttl?: number;
  forceRefresh?: boolean;
}

/**
 * Get value from cache
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.warn('[Cache] Get error for key', key, err);
  }
  return null;
}

/**
 * Set value in cache
 */
export async function setCached<T>(key: string, value: T, ttl: number = CACHE_TTL.FEED): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.warn('[Cache] Set error for key', key, err);
  }
}

/**
 * Delete cache key
 */
export async function delCached(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.warn('[Cache] Delete error:', err);
  }
}

/**
 * Delete cache by pattern (e.g., "feed:user:*")
 */
export async function delCachedPattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.warn('[Cache] Delete pattern error:', err);
  }
}

/**
 * Get or compute value with cache
 */
export async function getOrSet<T>(
  key: string,
  compute: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = CACHE_TTL.FEED, forceRefresh = false } = options;

  if (!forceRefresh) {
    const cached = await getCached<T>(key);
    if (cached) return cached;
  }

  const value = await compute();
  await setCached(key, value, ttl);
  return value;
}

/**
 * Cache invalidation helpers
 */
export const cacheKeys = {
  feed: (userId: string) => `feed:${userId}`,
  profile: (userId: string) => `profile:${userId}`,
  post: (postId: string) => `post:${postId}`,
  trending: () => 'trending:all',
  userPosts: (userId: string) => `user:posts:${userId}`,
  comments: (postId: string) => `comments:${postId}`,
  followers: (userId: string) => `followers:${userId}`,
  following: (userId: string) => `following:${userId}`,
  search: (query: string) => `search:${query.toLowerCase()}`,
};

/**
 * Invalidate user-related caches when data changes
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await delCached(
    cacheKeys.feed(userId),
    cacheKeys.profile(userId),
    cacheKeys.userPosts(userId),
    cacheKeys.followers(userId),
    cacheKeys.following(userId),
  );
}

/**
 * Invalidate post-related caches
 */
export async function invalidatePostCache(postId: string, userId: string): Promise<void> {
  await delCached(
    cacheKeys.post(postId),
    cacheKeys.comments(postId),
    cacheKeys.feed(userId),
    'trending:all',
  );
}

/**
 * Batch get from cache
 */
export async function getCachedBatch<T>(keys: string[]): Promise<(T | null)[]> {
  try {
    const values = await redis.mget(...keys);
    return values.map(v => v ? JSON.parse(v) as T : null);
  } catch (err) {
    console.warn('[Cache] Batch get error:', err);
    return keys.map(() => null);
  }
}

/**
 * Get Redis stats for monitoring
 */
export async function getCacheStats(): Promise<Record<string, any> | null> {
  try {
    const info = await redis.info('stats');
    const dbSize = await redis.dbsize();
    return { info, dbSize };
  } catch (err) {
    return null;
  }
}

export const CACHE_TTL_VALUES = CACHE_TTL;
