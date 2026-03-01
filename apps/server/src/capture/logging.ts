import { ORPCError } from "@orpc/server"
import { ZodError } from "zod"

export type CaptureSecurityReasonCode =
  | "disallowed_origin"
  | "inactive_public_key"
  | "invalid_payload"
  | "invalid_public_key"
  | "invalid_submit_token"
  | "invalid_turnstile_request"
  | "missing_origin"
  | "missing_public_key"
  | "missing_submit_token"
  | "missing_turnstile_token"
  | "protection_not_ready"
  | "rate_limited"
  | "replayed_submit_token"
  | "turnstile_verification_failed"
  | "unknown_error"

export function logCaptureSecurityEvent(input: {
  decision: "challenged" | "rejected"
  keyId?: string | null
  method: string
  origin?: string | null
  reasonCode: CaptureSecurityReasonCode
  route: string
  status: number
}): void {
  console.warn("[capture-security]", {
    decision: input.decision,
    keyId: input.keyId ?? null,
    method: input.method,
    origin: input.origin ?? null,
    reasonCode: input.reasonCode,
    route: input.route,
    status: input.status,
  })
}

export function logCaptureSecurityError(input: {
  error: unknown
  keyId?: string | null
  method: string
  origin?: string | null
  route: string
}): void {
  const orpcError = input.error instanceof ORPCError ? input.error : null
  const reasonCode = getCaptureSecurityReasonCode(input.error)
  const status =
    orpcError?.status ?? (input.error instanceof ZodError ? 400 : 500)

  logCaptureSecurityEvent({
    decision: "rejected",
    keyId: input.keyId,
    method: input.method,
    origin: input.origin,
    reasonCode,
    route: input.route,
    status,
  })
}

function getCaptureSecurityReasonCode(
  error: unknown
): CaptureSecurityReasonCode {
  if (error instanceof ORPCError) {
    const candidate = error.data?.reasonCode
    if (isCaptureSecurityReasonCode(candidate)) {
      return candidate
    }
  }

  if (error instanceof ZodError) {
    return "invalid_payload"
  }

  return "unknown_error"
}

function isCaptureSecurityReasonCode(
  value: unknown
): value is CaptureSecurityReasonCode {
  return (
    typeof value === "string" &&
    [
      "disallowed_origin",
      "inactive_public_key",
      "invalid_payload",
      "invalid_public_key",
      "invalid_submit_token",
      "invalid_turnstile_request",
      "missing_origin",
      "missing_public_key",
      "missing_submit_token",
      "missing_turnstile_token",
      "protection_not_ready",
      "rate_limited",
      "replayed_submit_token",
      "turnstile_verification_failed",
      "unknown_error",
    ].includes(value)
  )
}
