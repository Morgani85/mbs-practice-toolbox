import { LRUCache } from "lru-cache";

// Create a simple in-memory cache with TTL - Increased capacity for better performance
const cache = new LRUCache<string, any>({
  max: 1000, // Increased capacity for better performance
  ttl: 1000 * 60 * 3, // 3 minutes TTL for faster updates
});

export function getCacheKey(prefix: string, ...params: (string | number | null | undefined)[]): string {
  return `${prefix}:${params.filter(p => p !== null && p !== undefined).join(':')}`;
}

export function getFromCache<T>(key: string): T | undefined {
  return cache.get(key);
}

export function setInCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function invalidateCache(pattern?: string): void {
  if (pattern) {
    // Invalidate keys matching pattern
    cache.forEach((value, key) => {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    });
  } else {
    cache.clear();
  }
}

export { cache };