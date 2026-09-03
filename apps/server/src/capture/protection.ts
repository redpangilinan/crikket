import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { env } from "@crikket/env/server"
import { ORPCError } from "@orpc/server"
import { reserveCaptureNonce } from "./security"

const CAPTURE_SUBMIT_TOKEN_VERSION = 1
const CAPTURE_SUBMIT_TOKEN_TTL_MS = 5 * 60 * 1000
const CAPTURE_SUBMIT_TOKEN_REPLAY_PREFIX = "crikket:capture-submit-token"
const CAPTURE_FINALIZE_TOKEN_TTL_MS = 15 * 60 * 1000
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

interface CaptureSubmitTokenPayload {
  exp: number
  iat: number
  jti: string
  keyId: string
  origin: string
  type: "capture-submit"
  v: number
}

interface CaptureFinalizeTokenPayload {
  exp: number
  iat: number
  jti: string
  keyId: string
  origin: string
  reportId: string
  type: "capture-finalize"
  v: number
}

interface TurnstileVerifyResponse {
  "error-codes"?: unknown
  hostname?: unknown
  success?: unknown
}

interface TurnstileConfig {
  secretKey: string
  siteKey: string
}

export function isCaptureSubmitProtectionEnabled(): boolean {
  return Boolean(env.CAPTURE_SUBMIT_TOKEN_SECRET)
}

function getTurnstileConfig(): TurnstileConfig | null {
  if (!(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY)) {
    return null
  }

  return {
    secretKey: env.TURNSTILE_SECRET_KEY,
    siteKey: env.TURNSTILE_SITE_KEY,
  }
}

function requireTurnstileConfig(): TurnstileConfig {
  const config = getTurnstileConfig()
  if (!config) {
    throw new Error("Turnstile verification called without configuration.")
  }

  return config
}

export function getCaptureProtectionSiteKey(): string | null {
  return getTurnstileConfig()?.siteKey ?? null
}

export function shouldEnforceTurnstile(): boolean {
  if (!isCaptureSubmitProtectionEnabled()) {
    return false
  }

  return getTurnstileConfig() !== null
}

export function createCaptureSubmitToken(input: {
  keyId: string
  origin: string
  now?: number
}): {
  expiresAt: string
  token: string
} | null {
  const secret = env.CAPTURE_SUBMIT_TOKEN_SECRET
  if (!secret) {
    return null
  }

  const issuedAt = input.now ?? Date.now()
  const payload: CaptureSubmitTokenPayload = {
    exp: issuedAt + CAPTURE_SUBMIT_TOKEN_TTL_MS,
    iat: issuedAt,
    jti: randomUUID(),
    keyId: input.keyId,
    origin: input.origin,
    type: "capture-submit",
    v: CAPTURE_SUBMIT_TOKEN_VERSION,
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signValue(encodedPayload, secret)

  return {
    expiresAt: new Date(payload.exp).toISOString(),
    token: `${encodedPayload}.${signature}`,
  }
}

export async function verifyCaptureSubmitToken(input: {
  keyId: string
  now?: number
  origin: string
  token: string
}): Promise<void> {
  const secret = env.CAPTURE_SUBMIT_TOKEN_SECRET
  if (!secret) {
    return
  }

  const [encodedPayload, signature] = input.token.split(".")
  if (!(encodedPayload && signature)) {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_submit_token",
      },
      message: "Capture submit token is invalid.",
    })
  }

  const expectedSignature = signValue(encodedPayload, secret)
  if (!safeEqual(signature, expectedSignature)) {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_submit_token",
      },
      message: "Capture submit token is invalid.",
    })
  }

  const payload = parseTokenPayload(encodedPayload)
  const now = input.now ?? Date.now()

  if (payload.exp <= now) {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_submit_token",
      },
      message: "Capture submit token is invalid or expired.",
    })
  }

  if (
    payload.type !== "capture-submit" ||
    payload.v !== CAPTURE_SUBMIT_TOKEN_VERSION ||
    payload.keyId !== input.keyId ||
    payload.origin !== input.origin
  ) {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_submit_token",
      },
      message: "Capture submit token is invalid or expired.",
    })
  }

  await consumeCaptureSubmitToken({
    expiresAt: payload.exp,
    jti: payload.jti,
    now,
  })
}

export function createCaptureFinalizeToken(input: {
  keyId: string
  now?: number
  origin: string
  reportId: string
}): {
  expiresAt: string
  token: string
} | null {
  const secret = env.CAPTURE_SUBMIT_TOKEN_SECRET
  if (!secret) {
    return null
  }

  const issuedAt = input.now ?? Date.now()
  const payload: CaptureFinalizeTokenPayload = {
    exp: issuedAt + CAPTURE_FINALIZE_TOKEN_TTL_MS,
    iat: issuedAt,
    jti: randomUUID(),
    keyId: input.keyId,
    origin: input.origin,
    reportId: input.reportId,
    type: "capture-finalize",
    v: CAPTURE_SUBMIT_TOKEN_VERSION,
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signValue(encodedPayload, secret)

  return {
    expiresAt: new Date(payload.exp).toISOString(),
    token: `${encodedPayload}.${signature}`,
  }
}

export async function verifyCaptureFinalizeToken(input: {
  keyId: string
  now?: number
  origin: string
  reportId: string
  token: string
}): Promise<void> {
  const secret = env.CAPTURE_SUBMIT_TOKEN_SECRET
  if (!secret) {
    return
  }

  const [encodedPayload, signature] = input.token.split(".")
  if (!(encodedPayload && signature)) {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_finalize_token",
      },
      message: "Capture finalize token is invalid.",
    })
  }

  const expectedSignature = signValue(encodedPayload, secret)
  if (!safeEqual(signature, expectedSignature)) {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_finalize_token",
      },
      message: "Capture finalize token is invalid.",
    })
  }

  const payload = parseFinalizeTokenPayload(encodedPayload)
  const now = input.now ?? Date.now()

  if (payload.exp <= now) {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_finalize_token",
      },
      message: "Capture finalize token is invalid or expired.",
    })
  }

  if (
    payload.type !== "capture-finalize" ||
    payload.v !== CAPTURE_SUBMIT_TOKEN_VERSION ||
    payload.keyId !== input.keyId ||
    payload.origin !== input.origin ||
    payload.reportId !== input.reportId
  ) {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_finalize_token",
      },
      message: "Capture finalize token is invalid or expired.",
    })
  }

  await consumeCaptureSubmitToken({
    expiresAt: payload.exp,
    jti: payload.jti,
    now,
  })
}

export async function verifyTurnstileToken(input: {
  origin: string
  remoteIp?: string | null
  token: string
}): Promise<void> {
  const { secretKey } = requireTurnstileConfig()

  const requestBody = new URLSearchParams({
    response: input.token,
    secret: secretKey,
  })
  if (input.remoteIp) {
    requestBody.set("remoteip", input.remoteIp)
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: requestBody,
  })

  if (!response.ok) {
    throw new ORPCError("FORBIDDEN", {
      data: {
        reasonCode: "turnstile_verification_failed",
      },
      message: "Turnstile verification request failed.",
    })
  }

  const payload = (await response.json()) as TurnstileVerifyResponse
  if (payload.success !== true) {
    throw new ORPCError("FORBIDDEN", {
      data: {
        errors: normalizeErrorCodes(payload["error-codes"]),
        reasonCode: "turnstile_verification_failed",
      },
      message: "Anti-bot verification failed.",
    })
  }

  const expectedHostname = new URL(input.origin).hostname
  if (
    typeof payload.hostname === "string" &&
    payload.hostname.length > 0 &&
    payload.hostname !== expectedHostname
  ) {
    throw new ORPCError("FORBIDDEN", {
      data: {
        reasonCode: "turnstile_verification_failed",
      },
      message: "Anti-bot verification failed.",
    })
  }
}

function parseTokenPayload(encodedPayload: string): CaptureSubmitTokenPayload {
  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8")
    ) as Partial<CaptureSubmitTokenPayload>

    if (
      typeof payload.exp !== "number" ||
      typeof payload.iat !== "number" ||
      typeof payload.jti !== "string" ||
      typeof payload.keyId !== "string" ||
      typeof payload.origin !== "string" ||
      payload.type !== "capture-submit" ||
      typeof payload.v !== "number"
    ) {
      throw new Error("Invalid token payload shape.")
    }

    return payload as CaptureSubmitTokenPayload
  } catch {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_submit_token",
      },
      message: "Capture submit token is invalid.",
    })
  }
}

function parseFinalizeTokenPayload(
  encodedPayload: string
): CaptureFinalizeTokenPayload {
  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8")
    ) as Partial<CaptureFinalizeTokenPayload>

    if (
      typeof payload.exp !== "number" ||
      typeof payload.iat !== "number" ||
      typeof payload.jti !== "string" ||
      typeof payload.keyId !== "string" ||
      typeof payload.origin !== "string" ||
      typeof payload.reportId !== "string" ||
      payload.type !== "capture-finalize" ||
      typeof payload.v !== "number"
    ) {
      throw new Error("Invalid token payload shape.")
    }

    return payload as CaptureFinalizeTokenPayload
  } catch {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "invalid_finalize_token",
      },
      message: "Capture finalize token is invalid.",
    })
  }
}

async function consumeCaptureSubmitToken(input: {
  expiresAt: number
  jti: string
  now: number
}): Promise<void> {
  const ttlMs = Math.max(1, input.expiresAt - input.now)
  const replayKey = `${CAPTURE_SUBMIT_TOKEN_REPLAY_PREFIX}:${input.jti}`
  const reserved = await reserveCaptureNonce({
    key: replayKey,
    ttlMs,
  })

  if (!reserved) {
    throw new ORPCError("UNAUTHORIZED", {
      data: {
        reasonCode: "replayed_submit_token",
      },
      message: "Capture submit token has already been used.",
    })
  }
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url")
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url")
}

function normalizeErrorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}
