/**
 * Two-tier cache for the Vercel serverless functions.
 *
 *   L1  in-process memory, per warm lambda instance — the primary defence.
 *   L2  Upstash Redis over REST, shared between instances — optional.
 *
 * Both tiers are optional: with no Upstash credentials, an unreachable Upstash
 * host, or a cold lambda, `cachedFetch` still returns correct data straight
 * from the source. What it must never do is let a missing cache quietly turn
 * every request into a full-table Supabase pull.
 *
 * That is exactly what happened through July 2026. `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN` live in a git-ignored `.env`, and only `VITE_`-
 * prefixed variables get inlined at build time — server-side variables have to
 * be set in the Vercel project itself, and these never were. So Redis reported
 * itself disabled in production and *every* `/api/cache/*` request re-fetched
 * ~10 MB of jobs from Supabase: ~400 MB/day against a 5 GB monthly plan, with
 * `X-Cache-Hit: 0` on every endpoint and not one key ever written.
 *
 * The lesson encoded below is that the cache must not be the only thing
 * standing between a request and the source. The memory tier, the single-flight
 * dedupe and the stale-on-error fallback all keep egress bounded even when
 * Redis contributes nothing at all.
 */

import { gzipSync, gunzipSync } from 'node:zlib';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const REDIS_CONFIGURED = Boolean(UPSTASH_URL && UPSTASH_TOKEN);
if (!REDIS_CONFIGURED) {
  // Not fatal, but it is the difference between one shared cache and one cache
  // per lambda instance. Having this in `.env` is not enough — it has to be set
  // on the Vercel project, which is the bug that caused the July 2026 blowout.
  console.warn(
    '[cache] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set in this environment — ' +
      'running on the per-instance memory tier only. Set them on the Vercel project to share the cache.',
  );
}

// ─── L1: in-process memory ──────────────────────────────────────
// Survives for the life of a warm lambda instance, so it costs nothing and
// works even when Redis is unreachable. Entries are kept past their expiry so
// they can still be served if the source itself fails (see `cachedFetch`);
// the LRU cap is what bounds memory, not expiry.
interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

const memory = new Map<string, MemoryEntry>();

/** Cache values here are multi-MB, so keep the cap low. */
const MEMORY_MAX_ENTRIES = 12;

function memoryGet<T>(key: string, allowStale = false): T | undefined {
  const entry = memory.get(key);
  if (!entry) return undefined;
  if (!allowStale && Date.now() > entry.expiresAt) return undefined;

  // Re-insert to mark as most-recently-used.
  memory.delete(key);
  memory.set(key, entry);
  return entry.value as T;
}

function memorySet(key: string, value: unknown, ttlSeconds: number): void {
  memory.delete(key);
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });

  while (memory.size > MEMORY_MAX_ENTRIES) {
    const oldest = memory.keys().next();
    if (oldest.done) break;
    memory.delete(oldest.value);
  }
}

// ─── L2: Redis circuit breaker ──────────────────────────────────
// An expired token, a deleted database or an Upstash outage fails slowly — a
// round trip, or a DNS lookup and a timeout. Paying that on every request, for
// a cache that cannot answer, is worse than not calling it at all, so back off
// after a few consecutive failures and re-probe once the cooldown passes.
const REDIS_FAILURE_THRESHOLD = 3;
const REDIS_COOLDOWN_MS = 5 * 60_000;

let redisFailures = 0;
let redisMutedUntil = 0;

function redisUsable(): boolean {
  return REDIS_CONFIGURED && Date.now() >= redisMutedUntil;
}

function noteRedisSuccess(): void {
  redisFailures = 0;
}

function noteRedisFailure(op: string, err: unknown): void {
  redisFailures += 1;
  if (redisFailures < REDIS_FAILURE_THRESHOLD) {
    console.warn(`[cache] Redis ${op} failed, serving from memory/source:`, err);
    return;
  }
  redisMutedUntil = Date.now() + REDIS_COOLDOWN_MS;
  redisFailures = 0;
  console.warn(
    `[cache] Redis ${op} failed ${REDIS_FAILURE_THRESHOLD}x — muting Redis for ` +
      `${REDIS_COOLDOWN_MS / 60_000} min. Check UPSTASH_REDIS_REST_URL still points at a live database. ` +
      `Last error:`,
    err,
  );
}

// ─── L2: value encoding ─────────────────────────────────────────
// Gzip is what makes the big payloads cacheable at all: the trimmed jobs list
// is ~8.7 MB of JSON but only ~2.2 MB once gzipped and base64'd, which fits
// Upstash comfortably (probing this database, SET accepted values up to at
// least 8 MB). The cap is a guard, not a plan limit — anything above it is left
// to the memory tier and the CDN rather than retried on every miss, so a
// payload that grows past it degrades quietly instead of stalling every request.
const GZIP_PREFIX = 'gz:';
const REDIS_MAX_VALUE_BYTES = Number(process.env.REDIS_MAX_VALUE_BYTES ?? 4_000_000);

function encodeValue(value: unknown): string {
  const json = JSON.stringify(value);
  const gzipped = GZIP_PREFIX + gzipSync(Buffer.from(json, 'utf8')).toString('base64');
  return gzipped.length < json.length ? gzipped : json;
}

function decodeValue<T>(raw: string): T {
  if (!raw.startsWith(GZIP_PREFIX)) return JSON.parse(raw) as T;
  const buf = Buffer.from(raw.slice(GZIP_PREFIX.length), 'base64');
  return JSON.parse(gunzipSync(buf).toString('utf8')) as T;
}

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
  const res = await fetch(UPSTASH_URL!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', key, value, 'EX', ttlSeconds]),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Redis SET failed: ${res.status} - ${errText}`);
  }
}

// ─── Single-flight ──────────────────────────────────────────────
// Without this, N concurrent misses for the same key produce N identical
// full-table Supabase reads. Waiters piggyback on the first one instead.
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Cache-aside helper.
 *
 * @param key      Cache key, shared across both tiers
 * @param ttl      Time-to-live in seconds
 * @param fetcher  Async function that returns fresh data from the source (Supabase)
 * @returns        `{ data, cacheHit }` — the data and whether a source fetch was avoided
 */
export async function cachedFetch<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; cacheHit: boolean }> {
  // 1. Memory tier
  const fromMemory = memoryGet<T>(key);
  if (fromMemory !== undefined) return { data: fromMemory, cacheHit: true };

  // 2. Join an in-progress fetch for the same key rather than starting another
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return { data: await pending, cacheHit: true };

  let servedFromRedis = false;

  const work = (async (): Promise<T> => {
    // 3. Redis tier
    if (redisUsable()) {
      try {
        const raw = await redisGet(key);
        noteRedisSuccess();
        if (raw !== null) {
          const value = decodeValue<T>(raw);
          memorySet(key, value, ttl);
          servedFromRedis = true;
          return value;
        }
      } catch (err) {
        noteRedisFailure('GET', err);
      }
    }

    // 4. Source
    let data: T;
    try {
      data = await fetcher();
    } catch (err) {
      // Serving a stale copy beats surfacing an error and beats letting every
      // client fall back to its own direct Supabase query during an incident.
      const stale = memoryGet<T>(key, true);
      if (stale !== undefined) {
        console.warn(`[cache] Source fetch for "${key}" failed — serving stale memory copy:`, err);
        return stale;
      }
      throw err;
    }

    memorySet(key, data, ttl);

    // 5. Populate Redis for the other instances
    if (redisUsable()) {
      const encoded = encodeValue(data);
      if (encoded.length > REDIS_MAX_VALUE_BYTES) {
        console.warn(
          `[cache] "${key}" is ${encoded.length} bytes encoded, over the ` +
            `${REDIS_MAX_VALUE_BYTES}-byte Redis limit — memory tier + CDN only`,
        );
      } else {
        try {
          await redisSet(key, encoded, ttl);
          noteRedisSuccess();
        } catch (err) {
          noteRedisFailure('SET', err);
        }
      }
    }

    return data;
  })();

  inFlight.set(key, work);
  try {
    const data = await work;
    return { data, cacheHit: servedFromRedis };
  } finally {
    inFlight.delete(key);
  }
}
