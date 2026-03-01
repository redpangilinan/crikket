import { afterEach, describe, expect, it, mock } from "bun:test"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const CAPTURE_TOKEN_ROUTE_PATH = fileURLToPath(
  new URL("../src/capture/token-route.ts", import.meta.url)
)
const CAPTURE_SUBMIT_ROUTE_PATH = fileURLToPath(
  new URL("../src/capture/submit-route.ts", import.meta.url)
)
const CAPTURE_SUBMIT_PROTECTION_PATH = fileURLToPath(
  new URL("../src/capture/protection.ts", import.meta.url)
)

const replayKeys = new Set<string>()
const rateLimitedPrefixes = new Set<string>()
const validOrigin = "https://example.com"
const publicKeyRecord = {
  allowedOrigins: [validOrigin],
  createdAt: new Date(),
  createdBy: null,
  environment: "production",
  id: "key_123",
  key: "crk_test",
  label: "Example",
  organizationId: "org_123",
  revokedAt: null,
  rotatedAt: null,
  status: "active" as const,
  updatedAt: new Date(),
}
let activePublicKeyValue = publicKeyRecord.key
let activePublicKeyStatus: "active" | "revoked" = "active"

mock.module("@crikket/env/server", () => ({
  env: {
    BETTER_AUTH_URL: "https://app.crikket.io",
    CAPTURE_SUBMIT_TOKEN_SECRET: "01234567890123456789012345678901",
    CORS_ORIGINS: ["https://app.crikket.io"],
    NODE_ENV: "development",
    TURNSTILE_SECRET_KEY: "turnstile_secret",
    TURNSTILE_SITE_KEY: "turnstile_site",
    UPSTASH_REDIS_REST_TOKEN: "upstash_token",
    UPSTASH_REDIS_REST_URL: "https://upstash.example.com",
  },
}))

mock.module("@crikket/bug-reports/lib/capture-public-key", () => ({
  isCaptureOriginAllowed: (input: {
    origin: string
    record: { allowedOrigins: string[]; status: string }
  }) => {
    return (
      input.record.status === "active" &&
      input.record.allowedOrigins.includes(input.origin)
    )
  },
  isCapturePublicKeyActive: (record: { status: string }) => {
    return record.status === "active"
  },
  normalizeCaptureOrigin: (value: string) => {
    try {
      const parsed = new URL(value)
      return `${parsed.protocol}//${parsed.host}`.toLowerCase()
    } catch {
      return null
    }
  },
  resolveCapturePublicKey: (key: string) => {
    if (key !== activePublicKeyValue) {
      return null
    }

    return {
      ...publicKeyRecord,
      key: activePublicKeyValue,
      status: activePublicKeyStatus,
    }
  },
}))

mock.module("@crikket/bug-reports/lib/create-bug-report", () => ({
  createBugReportInputSchema: z.object({
    attachment: z.instanceof(Blob),
    attachmentType: z.string(),
    description: z.string().optional(),
    deviceInfo: z.unknown().optional(),
    debugger: z.unknown().optional(),
    metadata: z.unknown().optional(),
    priority: z.string().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    visibility: z.string().optional(),
  }),
  createBugReportRecord: async () => ({
    debugger: {
      dropped: { actions: 0, logs: 0, networkRequests: 0 },
      persisted: { actions: 0, logs: 0, networkRequests: 0 },
      requested: { actions: 0, logs: 0, networkRequests: 0 },
      warnings: [],
    },
    id: "br_123",
    shareUrl: "/s/br_123",
    warnings: [],
  }),
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

mock.module("@upstash/ratelimit", () => ({
  Ratelimit: class Ratelimit {
    prefix: string

    constructor(input: { prefix: string }) {
      this.prefix = input.prefix
    }

    static fixedWindow(limit: number, window: string) {
      return { limit, window }
    }

    limit(key: string) {
      if (rateLimitedPrefixes.has(`${this.prefix}:${key}`)) {
        return {
          limit: 1,
          remaining: 0,
          reset: Date.now() + 60_000,
          success: false,
        }
      }

      return {
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60_000,
        success: true,
      }
    }
  },
}))

afterEach(() => {
  activePublicKeyStatus = "active"
  activePublicKeyValue = publicKeyRecord.key
  replayKeys.clear()
  rateLimitedPrefixes.clear()
  mock.restore()
})

describe("capture token route", () => {
  it("rejects requests without an origin", async () => {
    const { handleCaptureToken } = await import(CAPTURE_TOKEN_ROUTE_PATH)
    const response = await handleCaptureToken({
      request: new Request("https://api.crikket.io/api/embed/capture-token", {
        headers: {
          "content-type": "application/json",
          "x-crikket-public-key": publicKeyRecord.key,
        },
        method: "POST",
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        reasonCode: "missing_origin",
      },
    })
  })

  it("rejects disallowed origins", async () => {
    const { handleCaptureToken } = await import(CAPTURE_TOKEN_ROUTE_PATH)
    const response = await handleCaptureToken({
      request: new Request("https://api.crikket.io/api/embed/capture-token", {
        headers: {
          origin: "https://evil.example.com",
          "content-type": "application/json",
          "x-crikket-public-key": publicKeyRecord.key,
        },
        method: "POST",
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        reasonCode: "disallowed_origin",
      },
    })
  })

  it("returns a challenge-required response before token minting", async () => {
    const { handleCaptureToken } = await import(CAPTURE_TOKEN_ROUTE_PATH)
    const response = await handleCaptureToken({
      request: new Request("https://api.crikket.io/api/embed/capture-token", {
        headers: {
          origin: validOrigin,
          "content-type": "application/json",
          "x-crikket-public-key": publicKeyRecord.key,
        },
        method: "POST",
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      challenge: {
        provider: "turnstile",
        siteKey: "turnstile_site",
      },
      code: "CAPTURE_CHALLENGE_REQUIRED",
    })
  })

  it("mints a token after successful challenge verification", async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ hostname: "example.com", success: true }),
          {
            headers: {
              "content-type": "application/json",
            },
            status: 200,
          }
        )
      )
    )
    globalThis.fetch = Object.assign(() => fetchMock(), {
      preconnect: originalFetch.preconnect,
    }) as typeof fetch

    const { handleCaptureToken } = await import(CAPTURE_TOKEN_ROUTE_PATH)
    const response = await handleCaptureToken({
      request: new Request("https://api.crikket.io/api/embed/capture-token", {
        body: JSON.stringify({ turnstileToken: "turnstile_response" }),
        headers: {
          origin: validOrigin,
          "content-type": "application/json",
          "x-crikket-public-key": publicKeyRecord.key,
        },
        method: "POST",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      token: expect.any(String),
    })

    globalThis.fetch = originalFetch
  })

  it("returns rate-limited when the token bucket blocks the request", async () => {
    rateLimitedPrefixes.add("crikket:rate-limit:capture:token:key:key_123")

    const { handleCaptureToken } = await import(CAPTURE_TOKEN_ROUTE_PATH)
    const response = await handleCaptureToken({
      request: new Request("https://api.crikket.io/api/embed/capture-token", {
        headers: {
          origin: validOrigin,
          "content-type": "application/json",
          "x-crikket-public-key": publicKeyRecord.key,
        },
        method: "POST",
      }),
    })

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    })
  })

  it("rejects revoked keys immediately", async () => {
    activePublicKeyStatus = "revoked"

    const { handleCaptureToken } = await import(CAPTURE_TOKEN_ROUTE_PATH)
    const response = await handleCaptureToken({
      request: new Request("https://api.crikket.io/api/embed/capture-token", {
        headers: {
          origin: validOrigin,
          "content-type": "application/json",
          "x-crikket-public-key": activePublicKeyValue,
        },
        method: "POST",
      }),
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        reasonCode: "inactive_public_key",
      },
    })
  })
})

describe("capture submit route", () => {
  it("rejects protected submits that are missing a token", async () => {
    const { handleCaptureSubmit } = await import(CAPTURE_SUBMIT_ROUTE_PATH)
    const response = await handleCaptureSubmit({
      request: createSubmitRequest(),
      shareOrigin: "https://app.crikket.io",
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        reasonCode: "missing_submit_token",
      },
    })
  })

  it("rejects invalid submit tokens", async () => {
    const { handleCaptureSubmit } = await import(CAPTURE_SUBMIT_ROUTE_PATH)
    const response = await handleCaptureSubmit({
      request: createSubmitRequest({
        headers: {
          "x-crikket-capture-token": "invalid.token",
        },
      }),
      shareOrigin: "https://app.crikket.io",
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        reasonCode: "invalid_submit_token",
      },
    })
  })

  it("rejects replayed submit tokens", async () => {
    const { createCaptureSubmitToken } = await import(
      CAPTURE_SUBMIT_PROTECTION_PATH
    )
    const authorization = createCaptureSubmitToken({
      keyId: publicKeyRecord.id,
      origin: validOrigin,
    })
    expect(authorization).not.toBeNull()

    const { handleCaptureSubmit } = await import(CAPTURE_SUBMIT_ROUTE_PATH)
    const firstResponse = await handleCaptureSubmit({
      request: createSubmitRequest({
        headers: {
          "x-crikket-capture-token": authorization!.token,
        },
      }),
      shareOrigin: "https://app.crikket.io",
    })
    expect(firstResponse.status).toBe(200)

    const secondResponse = await handleCaptureSubmit({
      request: createSubmitRequest({
        headers: {
          "x-crikket-capture-token": authorization!.token,
        },
      }),
      shareOrigin: "https://app.crikket.io",
    })
    expect(secondResponse.status).toBe(401)
    await expect(secondResponse.json()).resolves.toMatchObject({
      data: {
        reasonCode: "replayed_submit_token",
      },
    })
  })

  it("accepts a valid protected submit", async () => {
    const { createCaptureSubmitToken } = await import(
      CAPTURE_SUBMIT_PROTECTION_PATH
    )
    const authorization = createCaptureSubmitToken({
      keyId: publicKeyRecord.id,
      origin: validOrigin,
    })
    expect(authorization).not.toBeNull()

    const { handleCaptureSubmit } = await import(CAPTURE_SUBMIT_ROUTE_PATH)
    const response = await handleCaptureSubmit({
      request: createSubmitRequest({
        headers: {
          "x-crikket-capture-token": authorization!.token,
        },
      }),
      shareOrigin: "https://app.crikket.io",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: "br_123",
      reportId: "br_123",
      shareUrl: "https://app.crikket.io/s/br_123",
    })
  })

  it("returns rate-limited when the submit bucket blocks the request", async () => {
    rateLimitedPrefixes.add("crikket:rate-limit:capture:submit:key:key_123")
    const { createCaptureSubmitToken } = await import(
      CAPTURE_SUBMIT_PROTECTION_PATH
    )
    const authorization = createCaptureSubmitToken({
      keyId: publicKeyRecord.id,
      origin: validOrigin,
    })
    expect(authorization).not.toBeNull()

    const { handleCaptureSubmit } = await import(CAPTURE_SUBMIT_ROUTE_PATH)
    const response = await handleCaptureSubmit({
      request: createSubmitRequest({
        headers: {
          "x-crikket-capture-token": authorization!.token,
        },
      }),
      shareOrigin: "https://app.crikket.io",
    })

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    })
  })

  it("rejects the old value after key rotation and accepts the new one", async () => {
    const { handleCaptureToken } = await import(CAPTURE_TOKEN_ROUTE_PATH)
    const oldKey = activePublicKeyValue
    activePublicKeyValue = "crk_rotated"

    const oldKeyResponse = await handleCaptureToken({
      request: new Request("https://api.crikket.io/api/embed/capture-token", {
        headers: {
          origin: validOrigin,
          "content-type": "application/json",
          "x-crikket-public-key": oldKey,
        },
        method: "POST",
      }),
    })

    expect(oldKeyResponse.status).toBe(401)
    await expect(oldKeyResponse.json()).resolves.toMatchObject({
      data: {
        reasonCode: "invalid_public_key",
      },
    })

    const newKeyResponse = await handleCaptureToken({
      request: new Request("https://api.crikket.io/api/embed/capture-token", {
        headers: {
          origin: validOrigin,
          "content-type": "application/json",
          "x-crikket-public-key": activePublicKeyValue,
        },
        method: "POST",
      }),
    })

    expect(newKeyResponse.status).toBe(403)
    await expect(newKeyResponse.json()).resolves.toMatchObject({
      code: "CAPTURE_CHALLENGE_REQUIRED",
    })
  })
})

function createSubmitRequest(input?: {
  headers?: Record<string, string>
}): Request {
  const formData = new FormData()
  formData.set(
    "capture",
    new Blob(["capture"], { type: "image/png" }),
    "capture.png"
  )
  formData.set("captureType", "screenshot")
  formData.set("description", "Broken button")
  formData.set("pageTitle", "Checkout")
  formData.set("pageUrl", "https://example.com/checkout")
  formData.set("priority", "high")
  formData.set("title", "Checkout is broken")
  formData.set("visibility", "private")

  return new Request("https://api.crikket.io/api/embed/bug-reports", {
    body: formData,
    headers: {
      origin: validOrigin,
      "x-crikket-public-key": publicKeyRecord.key,
      ...input?.headers,
    },
    method: "POST",
  })
}
