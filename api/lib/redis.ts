/**
 * Upstash Redis REST client utility for Vercel serverless functions.
 * Uses pure fetch() — no npm dependency needed.
 *
 * Implements a cache-aside pattern via `cachedFetch()`:
 *   1. Try GET from Redis
 *   2. On miss → call fetcher → SET with TTL → return fresh data
 *   3. On Redis error → fallback to fetcher (never block on cache failure)
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL!;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

interface RedisResponse {
  result: string | null;
}

/** Low-level GET from Upstash REST API */
async function redisGet(key: string): Promise<string | null> {
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis GET failed: ${res.status}`);
  const body: RedisResponse = await res.json();
  return body.result;
}

/** Low-level SET with EX (expiry in seconds) via Upstash REST API */
async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSeconds}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status}`);
}

/**
 * Cache-aside helper.
 *
 * @param key      Redis key
 * @param ttl      Time-to-live in seconds
 * @param fetcher  Async function that returns fresh data from the source (Supabase)
 * @returns        `{ data, cacheHit }` — the data and whether it came from cache
 */
export async function cachedFetch<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; cacheHit: boolean }> {
  // 1. Try cache
  try {
    const cached = await redisGet(key);
    if (cached !== null) {
      return { data: JSON.parse(cached) as T, cacheHit: true };
    }
  } catch (err) {
    // Redis read failed — fall through to fetcher
    console.warn(`[redis] GET "${key}" failed, falling back to source:`, err);
  }

  // 2. Cache miss — fetch from source
  const data = await fetcher();

  // 3. Store in cache (fire-and-forget, don't block response)
  try {
    await redisSet(key, JSON.stringify(data), ttl);
  } catch (err) {
    console.warn(`[redis] SET "${key}" failed:`, err);
  }

  return { data, cacheHit: false };
}
