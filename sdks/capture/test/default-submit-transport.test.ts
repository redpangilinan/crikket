import { afterEach, describe, expect, it, mock } from "bun:test"

import { defaultSubmitTransport } from "../src/transport/default-submit-transport"
import type { CaptureSubmitRequest } from "../src/types"

const originalFetch = globalThis.fetch

const request = {
  config: {
    host: "https://api.crikket.io",
    key: "crk_transport",
    submitPath: "/api/embed/bug-reports",
    zIndex: 2_147_483_640,
  },
  report: {
    captureType: "screenshot",
    title: "Checkout issue",
    description: "Button is disabled",
    priority: "high",
    visibility: "public",
    pageUrl: "https://example.com/checkout",
    pageTitle: "Checkout",
    durationMs: null,
    sdkVersion: "1.0.0",
    deviceInfo: {
      browser: "bun-test",
    },
    debuggerSummary: {
      actions: 1,
      logs: 2,
      networkRequests: 3,
    },
    debuggerPayload: {
      actions: [],
      logs: [],
      networkRequests: [],
    },
    media: new Blob(["capture"], { type: "image/png" }),
  },
} satisfies CaptureSubmitRequest

afterEach(() => {
  mock.restore()
  globalThis.fetch = originalFetch
})

function installFetchMock(
  responseFactory: (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => Promise<Response>
) {
  const fetchMock = mock(responseFactory)

  globalThis.fetch = Object.assign(
    (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      fetchMock(input, init),
    {
      preconnect: originalFetch.preconnect,
    }
  )

  return fetchMock
}

describe("default submit transport regression", () => {
  it("mints a submit token, posts form data, and resolves relative share urls against the configured host", async () => {
    const fetchMock = installFetchMock(
      (
        input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1]
      ) =>
        Promise.resolve(
          String(input).endsWith("/capture-token")
            ? new Response(JSON.stringify({ token: "tok_123" }), {
                status: 200,
                headers: {
                  "content-type": "application/json",
                },
              })
            : new Response(
                JSON.stringify({ report: { id: "br_123", url: "/s/br_123" } }),
                {
                  status: 200,
                  headers: {
                    "content-type": "application/json",
                  },
                }
              )
        )
    )

    const result = await defaultSubmitTransport(request)

    expect(result).toEqual({
      reportId: "br_123",
      shareUrl: "https://api.crikket.io/s/br_123",
      raw: {
        report: {
          id: "br_123",
          url: "/s/br_123",
        },
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.crikket.io/api/embed/capture-token"
    )
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit",
      headers: {
        "content-type": "application/json",
        "x-crikket-public-key": "crk_transport",
      },
      method: "POST",
      mode: "cors",
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.crikket.io/api/embed/bug-reports"
    )
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      credentials: "omit",
      headers: {
        "x-crikket-capture-token": "tok_123",
        "x-crikket-public-key": "crk_transport",
      },
      method: "POST",
      mode: "cors",
    })
    const tokenBody = fetchMock.mock.calls[0]?.[1]?.body
    expect(tokenBody).toBe("{}")
    const body = fetchMock.mock.calls[1]?.[1]?.body
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get("visibility")).toBe("public")
  })

  it("surfaces json error payloads and falls back when the response is not json", async () => {
    installFetchMock(
      (
        input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1]
      ) =>
        Promise.resolve(
          String(input).endsWith("/capture-token")
            ? new Response(JSON.stringify({ token: "tok_123" }), {
                status: 200,
                headers: {
                  "content-type": "application/json",
                },
              })
            : new Response(JSON.stringify({ message: "Origin not allowed." }), {
                status: 403,
                headers: {
                  "content-type": "application/json",
                },
              })
        )
    )

    await expect(defaultSubmitTransport(request)).rejects.toThrow(
      "Origin not allowed."
    )

    installFetchMock(
      (
        input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1]
      ) =>
        Promise.resolve(
          String(input).endsWith("/capture-token")
            ? new Response(JSON.stringify({ token: "tok_123" }), {
                status: 200,
                headers: {
                  "content-type": "application/json",
                },
              })
            : new Response("upstream exploded", {
                status: 502,
                headers: {
                  "content-type": "text/plain",
                },
              })
        )
    )

    await expect(defaultSubmitTransport(request)).rejects.toThrow(
      "Capture submission failed with status 502."
    )
  })
})
