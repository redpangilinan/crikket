import {
  isCaptureOriginAllowed,
  isCapturePublicKeyActive,
  resolveCapturePublicKey,
} from "@crikket/bug-reports/lib/capture-public-key"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import { logCaptureSecurityError, logCaptureSecurityEvent } from "./logging"
import {
  assertCaptureSubmitProtectionReady,
  createCaptureSubmitToken,
  getCaptureProtectionSiteKey,
  shouldEnforceTurnstile,
  verifyTurnstileToken,
} from "./protection"
import {
  assertCaptureTokenRequestBodyLength,
  buildCaptureRateLimitErrorResponse,
  evaluateCaptureTokenRateLimit,
  getCaptureClientIp,
  getCaptureRequestOrigin,
} from "./security"

const captureTokenRequestSchema = z.object({
  turnstileToken: z.string().min(1).optional(),
})

function buildJsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  })
}

function toErrorResponse(
  error: unknown,
  context: {
    keyId?: string | null
    method: string
    origin?: string | null
    route: string
  }
): Response {
  logCaptureSecurityError({
    error,
    keyId: context.keyId,
    method: context.method,
    origin: context.origin,
    route: context.route,
  })

  if (error instanceof ORPCError) {
    return buildJsonResponse(error.toJSON(), {
      status: error.status,
    })
  }

  if (error instanceof z.ZodError) {
    return buildJsonResponse(
      {
        code: "BAD_REQUEST",
        issues: error.issues,
        message: "Invalid capture token request.",
      },
      {
        status: 400,
      }
    )
  }

  const message =
    error instanceof Error ? error.message : "Failed to authorize submission."

  return buildJsonResponse(
    {
      code: "INTERNAL_SERVER_ERROR",
      message,
    },
    {
      status: 500,
    }
  )
}

async function getRequestBody(
  request: Request
): Promise<z.infer<typeof captureTokenRequestSchema>> {
  const rawBody = await request.text()
  if (!rawBody.trim()) {
    return {}
  }

  try {
    return captureTokenRequestSchema.parse(JSON.parse(rawBody) as unknown)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ORPCError("BAD_REQUEST", {
        data: {
          reasonCode: "invalid_turnstile_request",
        },
        message: "Invalid JSON in capture token request.",
      })
    }

    if (error instanceof z.ZodError) {
      throw new ORPCError("BAD_REQUEST", {
        data: {
          reasonCode: "invalid_turnstile_request",
        },
        message: "Invalid capture token request.",
      })
    }

    throw error
  }
}

export async function handleCaptureToken(input: {
  request: Request
}): Promise<Response> {
  const route = "/api/embed/capture-token"
  let keyId: string | null = null
  let origin: string | null = null

  try {
    assertCaptureTokenRequestBodyLength(input.request)
    assertCaptureSubmitProtectionReady()

    const publicKey = input.request.headers.get("x-crikket-public-key")?.trim()
    if (!publicKey) {
      throw new ORPCError("UNAUTHORIZED", {
        data: {
          reasonCode: "missing_public_key",
        },
        message: "Capture public key is required.",
      })
    }

    const resolvedKey = await resolveCapturePublicKey(publicKey)
    if (!resolvedKey) {
      throw new ORPCError("UNAUTHORIZED", {
        data: {
          reasonCode: "invalid_public_key",
        },
        message: "Capture public key is invalid.",
      })
    }
    keyId = resolvedKey.id

    const resolvedOrigin = getCaptureRequestOrigin(input.request)
    if (resolvedOrigin) {
      origin = resolvedOrigin
    }

    if (!isCapturePublicKeyActive(resolvedKey)) {
      throw new ORPCError("UNAUTHORIZED", {
        data: {
          reasonCode: "inactive_public_key",
        },
        message: "Capture public key is no longer active.",
      })
    }
    if (!resolvedOrigin) {
      throw new ORPCError("FORBIDDEN", {
        data: {
          reasonCode: "missing_origin",
        },
        message: "Capture submission origin is required.",
      })
    }
    origin = resolvedOrigin

    if (
      !isCaptureOriginAllowed({
        origin: resolvedOrigin,
        record: resolvedKey,
      })
    ) {
      throw new ORPCError("FORBIDDEN", {
        data: {
          reasonCode: "disallowed_origin",
        },
        message: "Capture submission origin is not allowed for this key.",
      })
    }

    const rateLimitDecision = await evaluateCaptureTokenRateLimit({
      keyId: resolvedKey.id,
      origin: resolvedOrigin,
      request: input.request,
    })
    if (!rateLimitDecision.allowed) {
      logCaptureSecurityEvent({
        decision: "rejected",
        keyId,
        method: input.request.method,
        origin,
        reasonCode: "rate_limited",
        route,
        status: 429,
      })
      return buildCaptureRateLimitErrorResponse(rateLimitDecision)
    }

    const body = await getRequestBody(input.request)

    if (shouldEnforceTurnstile()) {
      if (!body.turnstileToken) {
        logCaptureSecurityEvent({
          decision: "challenged",
          keyId,
          method: input.request.method,
          origin,
          reasonCode: "missing_turnstile_token",
          route,
          status: 403,
        })
        return buildJsonResponse(
          {
            challenge: {
              provider: "turnstile",
              siteKey: getCaptureProtectionSiteKey(),
            },
            code: "CAPTURE_CHALLENGE_REQUIRED",
            message: "Anti-bot verification is required.",
          },
          {
            headers: rateLimitDecision.headers,
            status: 403,
          }
        )
      }

      await verifyTurnstileToken({
        origin: resolvedOrigin,
        remoteIp: getCaptureClientIp(input.request),
        token: body.turnstileToken,
      })
    }

    const authorization = createCaptureSubmitToken({
      keyId: resolvedKey.id,
      origin: resolvedOrigin,
    })

    return buildJsonResponse(
      {
        expiresAt: authorization?.expiresAt,
        token: authorization?.token,
      },
      {
        headers: rateLimitDecision.headers,
      }
    )
  } catch (error) {
    return toErrorResponse(error, {
      keyId,
      method: input.request.method,
      origin,
      route,
    })
  }
}
