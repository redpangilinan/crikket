import { afterEach, describe, expect, it, mock } from "bun:test"
import { fileURLToPath } from "node:url"

const originalFetch = globalThis.fetch
const CAPTURE_SUBMIT_PROTECTION_PATH = fileURLToPath(
  new URL("../src/capture/protection.ts", import.meta.url)
)
const replayKeys = new Set<string>()

mock.module("@crikket/env/server", () => ({
  env: {
    CAPTURE_SUBMIT_TOKEN_SECRET: "01234567890123456789012345678901",
    NODE_ENV: "development",
    TURNSTILE_SECRET_KEY: "turnstile_secret",
    TURNSTILE_SITE_KEY: "turnstile_site",
    UPSTASH_REDIS_REST_TOKEN: "upstash_token",
    UPSTASH_REDIS_REST_URL: "https://upstash.example.com",
  },
}))

mock.module("@upstash/redis", () => ({
  Redis: class Redis {
    set(key: string, _value: string, options?: { nx?: boolean; px?: number }) {
      if (options?.nx && replayKeys.has(key)) {
        return null
      }

      replayKeys.add(key)
      return "OK"
    }
  },
}))

afterEach(() => {
  globalThis.fetch = originalFetch
  replayKeys.clear()
})

describe("capture submit protection", () => {
  it("creates, verifies, and consumes short-lived submit tokens", async () => {
    const { createCaptureSubmitToken, verifyCaptureSubmitToken } = await import(
      CAPTURE_SUBMIT_PROTECTION_PATH
    )

    const authorization = createCaptureSubmitToken({
      keyId: "key_123",
      now: 1_700_000_000_000,
      origin: "https://example.com",
    })

    expect(authorization).not.toBeNull()
    expect(authorization?.token).toBeString()

    await expect(
      verifyCaptureSubmitToken({
        keyId: "key_123",
        now: 1_700_000_000_001,
        origin: "https://example.com",
        token: authorization!.token,
      })
    ).resolves.toBeUndefined()

    await expect(
      verifyCaptureSubmitToken({
        keyId: "key_123",
        now: 1_700_000_000_001,
        origin: "https://example.com",
        token: authorization!.token,
      })
    ).rejects.toThrow("Capture submit token has already been used.")

    await expect(
      verifyCaptureSubmitToken({
        keyId: "key_123",
        now: 1_700_000_000_001,
        origin: "https://other.example.com",
        token: authorization!.token,
      })
    ).rejects.toThrow("Capture submit token is invalid or expired.")
  })

  it("verifies turnstile responses against the request hostname", async () => {
    const { verifyTurnstileToken } = await import(
      CAPTURE_SUBMIT_PROTECTION_PATH
    )
    const fetchMock = mock(
      (
        _input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1]
      ) =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              hostname: "example.com",
              success: true,
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            }
          )
        )
    )

    globalThis.fetch = Object.assign(
      (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1]
      ) => fetchMock(input, init),
      {
        preconnect: originalFetch.preconnect,
      }
    )

    await expect(
      verifyTurnstileToken({
        origin: "https://example.com",
        remoteIp: "203.0.113.1",
        token: "turnstile_token",
      })
    ).resolves.toBeUndefined()

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body
    expect(String(requestBody)).toContain("secret=turnstile_secret")
    expect(String(requestBody)).toContain("response=turnstile_token")
    expect(String(requestBody)).toContain("remoteip=203.0.113.1")
  })
})
