import { describe, expect, it } from "bun:test"

import {
  type FixedWindowRateLimitResult,
  InMemoryFixedWindowRateLimiter,
  InMemoryNonceStore,
} from "../src/capture/in-memory-rate-limit"

// Coverage for the default (no-Redis) capture protection backend.

describe("InMemoryFixedWindowRateLimiter", () => {
  it("allows requests up to the limit and blocks beyond it", async () => {
    const limiter = new InMemoryFixedWindowRateLimiter({
      limit: 3,
      windowSeconds: 60,
    })

    const results: FixedWindowRateLimitResult[] = []
    for (let index = 0; index < 4; index += 1) {
      results.push(await limiter.limit("client-a"))
    }

    expect(results.map((result) => result.success)).toEqual([
      true,
      true,
      true,
      false,
    ])
    expect(results[0]?.remaining).toBe(2)
    expect(results[3]?.remaining).toBe(0)
    expect(results[3]?.limit).toBe(3)
  })

  it("tracks separate keys independently", async () => {
    const limiter = new InMemoryFixedWindowRateLimiter({
      limit: 1,
      windowSeconds: 60,
    })

    expect((await limiter.limit("a")).success).toBe(true)
    expect((await limiter.limit("a")).success).toBe(false)
    expect((await limiter.limit("b")).success).toBe(true)
  })

  it("resets after the window elapses", async () => {
    const limiter = new InMemoryFixedWindowRateLimiter({
      limit: 1,
      windowSeconds: 0.05,
    })

    expect((await limiter.limit("a")).success).toBe(true)
    expect((await limiter.limit("a")).success).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 80))

    expect((await limiter.limit("a")).success).toBe(true)
  })
})

describe("InMemoryNonceStore", () => {
  it("reserves a nonce once and rejects replays", () => {
    const store = new InMemoryNonceStore()

    expect(store.reserve("jti-1", 60_000)).toBe(true)
    expect(store.reserve("jti-1", 60_000)).toBe(false)
    expect(store.reserve("jti-2", 60_000)).toBe(true)
  })

  it("allows re-reservation after the ttl expires", async () => {
    const store = new InMemoryNonceStore()

    expect(store.reserve("jti-1", 40)).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 70))
    expect(store.reserve("jti-1", 40)).toBe(true)
  })
})
