// In-process fixed-window rate limiter for credential endpoints.
//
// Scope: this protects a single Node/Worker instance. Behind multiple
// instances or a multi-isolate Worker, each keeps its own counters, so treat it
// as a brake against brute force rather than a hard quota. A shared store
// (D1/Redis) is the upgrade path if the deployment ever scales horizontally.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Keep the map from growing without bound on a long-running process. */
function prune(now: number): void {
  if (buckets.size < 4096) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets; meaningful when allowed is false. */
  retryAfterSeconds: number;
}

export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Exposed for tests so counters do not leak between cases. */
export function resetRateLimits(): void {
  buckets.clear();
}
