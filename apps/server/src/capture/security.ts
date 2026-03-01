import { createHash } from "node:crypto"
import { isIP } from "node:net"
import { normalizeCaptureOrigin } from "@crikket/bug-reports/lib/capture-public-key"
import { env } from "@crikket/env/server"
import { ORPCError } from "@orpc/server"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const MAX_CAPTURE_REQUEST_BODY_BYTES = 110 * 1024 * 1024
const MAX_CAPTURE_TOKEN_REQUEST_BODY_BYTES = 16 * 1024
const CAPTURE_RATE_LIMIT_CONFIG = {
  submit: {
    ipMax: 12,
    keyMax: 60,
    message: "Too many capture submissions. Please try again soon.",
    originMax: 180,
    prefix: "crikket:rate-limit:capture:submit",
    windowSeconds: 60,
  },
  token: {
    ipMax: 8,
    keyMax: 40,
    message: "Too many capture authorization attempts. Please try again soon.",
    originMax: 120,
    prefix: "crikket:rate-limit:capture:token",
    windowSeconds: 60,
  },
} as const
const RATE_LIMIT_ERROR_LOG_INTERVAL_MS = 60_000
const CLIENT_ID_FALLBACK = "anonymous"

type RateLimitHeaders = Record<string, string>

type AllowedCaptureRateLimitDecision = {
  allowed: true
  headers: RateLimitHeaders
}

type BlockedCaptureRateLimitDecision = {
  allowed: false
  headers: RateLimitHeaders
  message: string
  retryAfterSeconds: number
}

export type CaptureRateLimitDecision =
  | AllowedCaptureRateLimitDecision
  | BlockedCaptureRateLimitDecision

type CaptureRateLimiters = {
  submit: CaptureScopedRateLimiters
  token: CaptureScopedRateLimiters
}

type CaptureRateLimitScope = keyof typeof CAPTURE_RATE_LIMIT_CONFIG

type CaptureScopedRateLimiters = {
  ip: Ratelimit
  key: Ratelimit
  origin: Ratelimit
}

type RateLimitResult = {
  limit: number
  remaining: number
  reset: number
  success: boolean
}

let captureRateLimiters: CaptureRateLimiters | undefined
let captureRedisClient: Redis | undefined
let lastRateLimitErrorLoggedAt = 0

function getRateLimitWindow(windowSeconds: number): `${number} s` {
  return `${windowSeconds} s`
}

export function hasCaptureRedisConfig(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
}

function getCaptureRateLimiters(): CaptureRateLimiters | null {
  const redis = getCaptureRedis()
  if (!redis) {
    return null
  }

  if (captureRateLimiters) {
    return captureRateLimiters
  }

  captureRateLimiters = {
    submit: createScopedCaptureRateLimiters({
      redis,
      scope: "submit",
    }),
    token: createScopedCaptureRateLimiters({
      redis,
      scope: "token",
    }),
  }

  return captureRateLimiters
}

function createScopedCaptureRateLimiters(input: {
  redis: Redis
  scope: CaptureRateLimitScope
}): CaptureScopedRateLimiters {
  const config = CAPTURE_RATE_LIMIT_CONFIG[input.scope]
  const window = getRateLimitWindow(config.windowSeconds)

  return {
    ip: new Ratelimit({
      redis: input.redis,
      limiter: Ratelimit.fixedWindow(config.ipMax, window),
      prefix: `${config.prefix}:ip`,
    }),
    key: new Ratelimit({
      redis: input.redis,
      limiter: Ratelimit.fixedWindow(config.keyMax, window),
      prefix: `${config.prefix}:key`,
    }),
    origin: new Ratelimit({
      redis: input.redis,
      limiter: Ratelimit.fixedWindow(config.originMax, window),
      prefix: `${config.prefix}:origin`,
    }),
  }
}

export function getCaptureRedis(): Redis | null {
  if (!hasCaptureRedisConfig()) {
    return null
  }

  if (captureRedisClient) {
    return captureRedisClient
  }

  captureRedisClient = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })

  return captureRedisClient
}

function normalizeIpCandidate(value: string): string | null {
  let candidate = value.trim()
  if (!candidate) {
    return null
  }

  if (candidate.startsWith("for=")) {
    candidate = candidate.slice(4)
  }

  candidate = candidate.replace(/^"+|"+$/g, "")

  if (candidate.startsWith("[")) {
    const end = candidate.indexOf("]")
    if (end > 0) {
      candidate = candidate.slice(1, end)
    }
  }

  if (candidate.startsWith("::ffff:")) {
    candidate = candidate.slice(7)
  }

  if (
    candidate.includes(".") &&
    candidate.includes(":") &&
    candidate.lastIndexOf(":") > candidate.indexOf(".")
  ) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"))
  }

  return isIP(candidate) ? candidate : null
}

export function getCaptureClientIp(request: Request): string | null {
  const directHeaders = [
    "cf-connecting-ip",
    "x-real-ip",
    "fly-client-ip",
  ] as const

  for (const headerName of directHeaders) {
    const rawValue = request.headers.get(headerName)
    if (!rawValue) {
      continue
    }

    const normalizedIp = normalizeIpCandidate(rawValue)
    if (normalizedIp) {
      return normalizedIp
    }
  }

  return null
}

function getFallbackFingerprint(request: Request): string {
  const fingerprintSource = [
    request.headers.get("user-agent")?.trim() ?? "",
    request.headers.get("accept-language")?.trim() ?? "",
    request.headers.get("sec-ch-ua")?.trim() ?? "",
    request.headers.get("sec-ch-ua-platform")?.trim() ?? "",
  ].join("|")

  if (!fingerprintSource.replaceAll("|", "")) {
    return CLIENT_ID_FALLBACK
  }

  return createHash("sha256")
    .update(fingerprintSource)
    .digest("hex")
    .slice(0, 16)
}

function getIpIdentifier(request: Request): string {
  const ipAddress = getCaptureClientIp(request)
  if (ipAddress) {
    return ipAddress
  }

  return `fp:${getFallbackFingerprint(request)}`
}

function getRateLimitHeaders(result: RateLimitResult): RateLimitHeaders {
  return {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(Math.max(result.remaining, 0)),
    "x-ratelimit-reset": String(Math.ceil(result.reset / 1000)),
  }
}

function getRetryAfterSeconds(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000))
}

function toBlockedRateLimitDecision(
  result: RateLimitResult,
  message: string
): BlockedCaptureRateLimitDecision {
  const retryAfterSeconds = getRetryAfterSeconds(result.reset)

  return {
    allowed: false,
    headers: {
      ...getRateLimitHeaders(result),
      "retry-after": String(retryAfterSeconds),
    },
    message,
    retryAfterSeconds,
  }
}

function logRateLimitError(error: unknown): void {
  const now = Date.now()
  if (now - lastRateLimitErrorLoggedAt < RATE_LIMIT_ERROR_LOG_INTERVAL_MS) {
    return
  }

  lastRateLimitErrorLoggedAt = now
  console.error(
    "[capture-rate-limit] Upstash limiter failed; continuing without block",
    {
      error,
    }
  )
}

async function limitWithFailOpen(
  limiter: Ratelimit,
  key: string
): Promise<RateLimitResult | null> {
  try {
    return await limiter.limit(key)
  } catch (error) {
    logRateLimitError(error)
    return null
  }
}

function getStrictestResult(results: [RateLimitResult, ...RateLimitResult[]]) {
  return results.reduce((strictest, current) => {
    const strictestRatio = strictest.remaining / strictest.limit
    const currentRatio = current.remaining / current.limit

    if (currentRatio < strictestRatio) {
      return current
    }

    if (
      currentRatio === strictestRatio &&
      current.remaining < strictest.remaining
    ) {
      return current
    }

    return strictest
  })
}

function parseHeaderNumber(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function assertCaptureRequestBodyLength(
  request: Request,
  maxBytes = MAX_CAPTURE_REQUEST_BODY_BYTES
): void {
  const contentLength = parseHeaderNumber(request.headers.get("content-length"))
  if (contentLength === null) {
    return
  }

  if (contentLength > maxBytes) {
    const limitLabel =
      maxBytes >= 1024 * 1024
        ? `${Math.floor(maxBytes / 1024 / 1024)} MB`
        : `${Math.floor(maxBytes / 1024)} KB`
    throw new ORPCError("PAYLOAD_TOO_LARGE", {
      message: `Capture request body exceeds ${limitLabel} limit.`,
    })
  }
}

export function assertCaptureTokenRequestBodyLength(request: Request): void {
  assertCaptureRequestBodyLength(request, MAX_CAPTURE_TOKEN_REQUEST_BODY_BYTES)
}

export function getCaptureRequestOrigin(request: Request): string | null {
  const headerOrigin = request.headers.get("origin")
  if (headerOrigin) {
    return normalizeCaptureOrigin(headerOrigin)
  }

  const refererHeader = request.headers.get("referer")
  if (!refererHeader) {
    return null
  }

  try {
    return normalizeCaptureOrigin(new URL(refererHeader).origin)
  } catch {
    return null
  }
}

export function evaluateCaptureSubmitRateLimit(input: {
  keyId: string
  origin?: string | null
  request: Request
}): Promise<CaptureRateLimitDecision> {
  return evaluateCaptureRateLimit({
    keyId: input.keyId,
    origin: input.origin,
    request: input.request,
    scope: "submit",
  })
}

export function evaluateCaptureTokenRateLimit(input: {
  keyId: string
  origin?: string | null
  request: Request
}): Promise<CaptureRateLimitDecision> {
  return evaluateCaptureRateLimit({
    keyId: input.keyId,
    origin: input.origin,
    request: input.request,
    scope: "token",
  })
}

async function evaluateCaptureRateLimit(input: {
  keyId: string
  origin?: string | null
  request: Request
  scope: CaptureRateLimitScope
}): Promise<CaptureRateLimitDecision> {
  if (input.request.method === "OPTIONS") {
    return {
      allowed: true,
      headers: {},
    }
  }

  const limiters = getCaptureRateLimiters()
  if (!limiters) {
    return {
      allowed: true,
      headers: {},
    }
  }

  const scopedLimiters = limiters[input.scope]
  const config = CAPTURE_RATE_LIMIT_CONFIG[input.scope]
  const results: RateLimitResult[] = []

  const keyResult = await limitWithFailOpen(scopedLimiters.key, input.keyId)
  if (keyResult) {
    results.push(keyResult)
    if (!keyResult.success) {
      return toBlockedRateLimitDecision(keyResult, config.message)
    }
  }

  const ipResult = await limitWithFailOpen(
    scopedLimiters.ip,
    getIpIdentifier(input.request)
  )
  if (ipResult) {
    results.push(ipResult)
    if (!ipResult.success) {
      return toBlockedRateLimitDecision(ipResult, config.message)
    }
  }

  if (input.origin) {
    const originResult = await limitWithFailOpen(
      scopedLimiters.origin,
      input.origin
    )
    if (originResult) {
      results.push(originResult)
      if (!originResult.success) {
        return toBlockedRateLimitDecision(originResult, config.message)
      }
    }
  }

  if (results.length === 0) {
    return {
      allowed: true,
      headers: {},
    }
  }

  const strictestResult = getStrictestResult(
    results as [RateLimitResult, ...RateLimitResult[]]
  )

  return {
    allowed: true,
    headers: getRateLimitHeaders(strictestResult),
  }
}

export function buildCaptureRateLimitErrorResponse(
  decision: BlockedCaptureRateLimitDecision
): Response {
  const error = new ORPCError("TOO_MANY_REQUESTS", {
    message: decision.message,
    data: {
      retryAfterSeconds: decision.retryAfterSeconds,
    },
  })

  return new Response(JSON.stringify(error.toJSON()), {
    status: error.status,
    headers: {
      "content-type": "application/json",
      ...decision.headers,
    },
  })
}
