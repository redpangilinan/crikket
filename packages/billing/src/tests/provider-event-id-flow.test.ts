import { beforeAll, describe, expect, it } from "bun:test"

process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/test"
process.env.BETTER_AUTH_SECRET ??= "01234567890123456789012345678901"
process.env.BETTER_AUTH_URL ??= "http://localhost:3000"
Object.assign(process.env, { NODE_ENV: "development" })

let extractProviderEventId: typeof import("../service/polar-payload").extractProviderEventId

beforeAll(async () => {
  ;({ extractProviderEventId } = await import("../service/polar-payload"))
})

describe("extractProviderEventId flow", () => {
  it("uses provider event id when present", () => {
    const providerEventId = extractProviderEventId(
      {
        id: "evt_123",
        type: "subscription.updated",
      },
      "subscription.updated"
    )

    expect(providerEventId).toBe("polar:event:evt_123")
  })

  it("builds deterministic fallback ids when provider event id is missing", () => {
    const payload = {
      type: "subscription.updated",
      data: {
        subscriptionId: "sub_123",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    }

    const first = extractProviderEventId(payload, "subscription.updated")
    const second = extractProviderEventId(payload, "subscription.updated")

    expect(first).toBe(second)
    expect(
      first.startsWith("polar:fallback:subscription.updated:sub_123:")
    ).toBe(true)
  })

  it("keeps fallback id stable when payload keys are reordered", () => {
    const payloadA = {
      type: "subscription.updated",
      data: {
        subscriptionId: "sub_123",
        createdAt: "2026-01-01T00:00:00.000Z",
        metadata: {
          referenceId: "org_1",
          source: "polar",
        },
      },
    }
    const payloadB = {
      data: {
        metadata: {
          source: "polar",
          referenceId: "org_1",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        subscriptionId: "sub_123",
      },
      type: "subscription.updated",
    }

    const first = extractProviderEventId(payloadA, "subscription.updated")
    const second = extractProviderEventId(payloadB, "subscription.updated")

    expect(first).toBe(second)
  })
})
