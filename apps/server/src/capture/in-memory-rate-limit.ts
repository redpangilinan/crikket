// In-memory fixed-window rate limiting and single-use nonce tracking for the
// capture API. This is the default backend when no external Redis (Upstash) is
// configured, so a self-hosted single-instance server is rate limited out of
// the box rather than running with protection entirely off. A horizontally
// scaled deployment should set UPSTASH_REDIS_REST_* to share state across
// instances.

export interface FixedWindowRateLimitResult {
  limit: number
  remaining: number
  reset: number
  success: boolean
}

export interface ScopedRateLimiter {
  limit(key: string): Promise<FixedWindowRateLimitResult>
}

interface FixedWindowBucket {
  count: number
  resetAt: number
}

const MAX_TRACKED_KEYS = 50_000

export class InMemoryFixedWindowRateLimiter implements ScopedRateLimiter {
  private readonly buckets = new Map<string, FixedWindowBucket>()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(input: { limit: number; windowSeconds: number }) {
    this.maxRequests = input.limit
    this.windowMs = input.windowSeconds * 1000
  }

  limit(key: string): Promise<FixedWindowRateLimitResult> {
    const now = Date.now()
    let bucket = this.buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + this.windowMs,
      }
      this.buckets.set(key, bucket)
    }

    bucket.count += 1
    this.pruneIfNeeded(now)

    const success = bucket.count <= this.maxRequests
    const remaining = Math.max(0, this.maxRequests - bucket.count)

    return Promise.resolve({
      limit: this.maxRequests,
      remaining,
      reset: bucket.resetAt,
      success,
    })
  }

  private pruneIfNeeded(now: number): void {
    if (this.buckets.size <= MAX_TRACKED_KEYS) {
      return
    }

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key)
      }
    }
  }
}

export class InMemoryNonceStore {
  private readonly nonces = new Map<string, number>()

  // Reserves a nonce for the given TTL. Returns true when the nonce was newly
  // reserved and false when it was already reserved (i.e. a replay).
  reserve(key: string, ttlMs: number): boolean {
    const now = Date.now()
    this.pruneExpired(now)

    const existingExpiry = this.nonces.get(key)
    if (existingExpiry !== undefined && existingExpiry > now) {
      return false
    }

    this.nonces.set(key, now + ttlMs)
    return true
  }

  private pruneExpired(now: number): void {
    for (const [key, expiresAt] of this.nonces) {
      if (expiresAt <= now) {
        this.nonces.delete(key)
      }
    }
  }
}
