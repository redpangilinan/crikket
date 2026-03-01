import { createContext } from "@crikket/api/context"
import {
  buildRpcRateLimitErrorResponse,
  evaluateRpcRateLimit,
} from "@crikket/api/rate-limit"
import { appRouter } from "@crikket/api/routers/index"
import { auth } from "@crikket/auth"
import { runAttachmentCleanupPass } from "@crikket/bug-reports/lib/storage"
import { env } from "@crikket/env/server"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins"
import { onError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { handleCaptureSubmit } from "./capture/submit-route"
import { handleCaptureToken } from "./capture/token-route"

const app = new Hono()
const allowedCorsOrigins = env.CORS_ORIGINS
const fallbackCorsOrigin = allowedCorsOrigins[0] ?? env.BETTER_AUTH_URL
const captureShareOrigin = allowedCorsOrigins[0] ?? env.BETTER_AUTH_URL
const MAX_RPC_REQUEST_BODY_BYTES = 110 * 1024 * 1024
const STORAGE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000
type RateLimitHeaders = Record<string, string>

function parseHeaderNumber(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildPayloadTooLargeResponse(maxBytes: number): Response {
  return new Response(
    JSON.stringify({
      code: "PAYLOAD_TOO_LARGE",
      message: `Request body exceeds ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`,
    }),
    {
      status: 413,
      headers: {
        "content-type": "application/json",
      },
    }
  )
}

function buildLengthRequiredResponse(): Response {
  return new Response(
    JSON.stringify({
      code: "LENGTH_REQUIRED",
      message: "Content-Length header is required for RPC POST requests.",
    }),
    {
      status: 411,
      headers: {
        "content-type": "application/json",
      },
    }
  )
}

function selectStrictestRateLimitHeaders(
  current: RateLimitHeaders,
  incoming: RateLimitHeaders
): RateLimitHeaders {
  if (Object.keys(current).length === 0) {
    return incoming
  }

  if (Object.keys(incoming).length === 0) {
    return current
  }

  const currentLimit = parseHeaderNumber(current["x-ratelimit-limit"])
  const incomingLimit = parseHeaderNumber(incoming["x-ratelimit-limit"])
  const currentRemaining = parseHeaderNumber(current["x-ratelimit-remaining"])
  const incomingRemaining = parseHeaderNumber(incoming["x-ratelimit-remaining"])

  if (
    currentLimit === null ||
    incomingLimit === null ||
    currentRemaining === null ||
    incomingRemaining === null ||
    currentLimit <= 0 ||
    incomingLimit <= 0
  ) {
    return incoming
  }

  const currentRatio = currentRemaining / currentLimit
  const incomingRatio = incomingRemaining / incomingLimit

  if (incomingRatio < currentRatio) {
    return incoming
  }

  if (incomingRatio === currentRatio && incomingRemaining < currentRemaining) {
    return incoming
  }

  return current
}

app.use(logger())
app.use(
  "/*",
  cors({
    origin: (origin, c) => {
      if (
        (c.req.path === "/api/embed/bug-reports" ||
          c.req.path === "/api/embed/capture-token") &&
        origin.trim().length > 0
      ) {
        return origin
      }
      if (allowedCorsOrigins.includes(origin)) return origin
      if (origin.startsWith("chrome-extension://")) return origin
      return fallbackCorsOrigin
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "x-crikket-capture-token",
      "x-crikket-public-key",
    ],
    credentials: true,
  })
)

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
app.post("/api/embed/capture-token", (c) => {
  return handleCaptureToken({
    request: c.req.raw,
  })
})
app.post("/api/embed/bug-reports", (c) => {
  return handleCaptureSubmit({
    request: c.req.raw,
    shareOrigin: captureShareOrigin,
  })
})

const cleanupInterval = setInterval(() => {
  runAttachmentCleanupPass({ limit: 50 }).catch((error: unknown) => {
    console.error("[storage-cleanup] failed scheduled cleanup pass", error)
  })
}, STORAGE_CLEANUP_INTERVAL_MS)

cleanupInterval.unref?.()

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

app.use("/*", async (c, next) => {
  if (c.req.method === "POST" && c.req.path.startsWith("/rpc/")) {
    const contentLength = parseHeaderNumber(
      c.req.raw.headers.get("content-length") ?? undefined
    )
    if (contentLength === null) {
      return buildLengthRequiredResponse()
    }
    if (contentLength > MAX_RPC_REQUEST_BODY_BYTES) {
      return buildPayloadTooLargeResponse(MAX_RPC_REQUEST_BODY_BYTES)
    }
  }

  const ipRateLimitDecision = await evaluateRpcRateLimit(c.req.raw, {
    skipUser: true,
  })
  if (!ipRateLimitDecision.allowed) {
    return buildRpcRateLimitErrorResponse(ipRateLimitDecision)
  }
  let rateLimitHeaders = ipRateLimitDecision.headers

  const context = await createContext({ context: c })
  const userId = context.session?.user.id

  if (userId) {
    const userRateLimitDecision = await evaluateRpcRateLimit(c.req.raw, {
      userId,
      skipIp: true,
    })

    if (!userRateLimitDecision.allowed) {
      return buildRpcRateLimitErrorResponse(userRateLimitDecision)
    }

    rateLimitHeaders = selectStrictestRateLimitHeaders(
      rateLimitHeaders,
      userRateLimitDecision.headers
    )
  }

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context,
  })

  if (rpcResult.matched) {
    const headers = new Headers(rpcResult.response.headers)
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      headers.set(key, value)
    }

    return new Response(rpcResult.response.body, {
      status: rpcResult.response.status,
      statusText: rpcResult.response.statusText,
      headers,
    })
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context,
  })

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response)
  }

  await next()
})

app.get("/", (c) => {
  return c.text("OK")
})

export default app
