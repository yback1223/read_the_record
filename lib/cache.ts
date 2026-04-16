import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_KV_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = getRedis();
    if (!r) return null;
    return await r.get<T>(key);
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 30,
): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.set(key, value, { ex: ttlSeconds });
  } catch {
    // ignore
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.del(key);
  } catch {
    // ignore
  }
}

export async function cacheDel2(...keys: string[]): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.del(...keys);
  } catch {
    // ignore
  }
}
