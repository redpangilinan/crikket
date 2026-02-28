import {
  isCaptureOriginAllowed,
  isCapturePublicKeyActive,
  resolveCapturePublicKey,
} from "@crikket/bug-reports/lib/capture-public-key"
import {
  createBugReportInputSchema,
  createBugReportRecord,
} from "@crikket/bug-reports/lib/create-bug-report"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import {
  assertCaptureRequestBodyLength,
  buildCaptureRateLimitErrorResponse,
  evaluateCaptureSubmitRateLimit,
  getCaptureRequestOrigin,
} from "./capture-submit-security"

const CAPTURE_FIELD_NAME = "capture"

interface FormDataLike {
  get: (name: string) => string | Blob | null
}

function buildJsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  })
}

function getOptionalString(
  formData: FormDataLike,
  key: string
): string | undefined {
  const value = formData.get(key)
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function getOptionalNumber(
  formData: FormDataLike,
  key: string
): number | undefined {
  const value = getOptionalString(formData, key)
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function getJsonField<T>(formData: FormDataLike, key: string): T | undefined {
  const value = getOptionalString(formData, key)
  if (!value) {
    return undefined
  }

  try {
    return JSON.parse(value) as T
  } catch {
    throw new ORPCError("BAD_REQUEST", {
      message: `Invalid JSON in ${key}.`,
    })
  }
}

function getAttachment(formData: FormDataLike): Blob {
  const value = formData.get(CAPTURE_FIELD_NAME)

  if (!(value instanceof Blob) || value.size === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Capture attachment is required.",
    })
  }

  return value
}

function getFallbackDeviceInfo(request: Request): {
  browser?: string
  os?: string
  viewport?: string
} {
  const userAgent = request.headers.get("user-agent")?.trim()

  return {
    browser: userAgent || undefined,
  }
}

function toErrorResponse(error: unknown): Response {
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
        message: "Invalid capture submission payload.",
      },
      {
        status: 400,
      }
    )
  }

  const message =
    error instanceof Error ? error.message : "Failed to submit capture report."

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

export async function handleCaptureSubmit(input: {
  request: Request
  shareOrigin: string
}): Promise<Response> {
  try {
    assertCaptureRequestBodyLength(input.request)

    const publicKey = input.request.headers.get("x-crikket-public-key")?.trim()
    if (!publicKey) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Capture public key is required.",
      })
    }

    const resolvedKey = await resolveCapturePublicKey(publicKey)
    if (!resolvedKey) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Capture public key is invalid.",
      })
    }

    if (!isCapturePublicKeyActive(resolvedKey)) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Capture public key is no longer active.",
      })
    }

    const origin = getCaptureRequestOrigin(input.request)
    if (!origin) {
      throw new ORPCError("FORBIDDEN", {
        message: "Capture submission origin is required.",
      })
    }

    if (
      !isCaptureOriginAllowed({
        origin,
        record: resolvedKey,
      })
    ) {
      throw new ORPCError("FORBIDDEN", {
        message: "Capture submission origin is not allowed for this key.",
      })
    }

    const rateLimitDecision = await evaluateCaptureSubmitRateLimit({
      keyId: resolvedKey.id,
      request: input.request,
    })
    if (!rateLimitDecision.allowed) {
      return buildCaptureRateLimitErrorResponse(rateLimitDecision)
    }

    const formData = await input.request.formData()
    const durationMs = getOptionalNumber(formData, "durationMs")
    const sdkVersion = getOptionalString(formData, "sdkVersion")
    const pageTitle = getOptionalString(formData, "pageTitle")
    const deviceInfo =
      getJsonField<{
        browser?: string
        os?: string
        viewport?: string
      }>(formData, "deviceInfo") ?? getFallbackDeviceInfo(input.request)
    const debuggerPayload = getJsonField<{
      actions?: unknown[]
      logs?: unknown[]
      networkRequests?: unknown[]
    }>(formData, "debuggerPayload")

    const createInput = createBugReportInputSchema.parse({
      attachment: getAttachment(formData),
      attachmentType: getOptionalString(formData, "captureType"),
      description: getOptionalString(formData, "description"),
      deviceInfo,
      debugger: debuggerPayload
        ? {
            actions: debuggerPayload.actions ?? [],
            logs: debuggerPayload.logs ?? [],
            networkRequests: debuggerPayload.networkRequests ?? [],
          }
        : undefined,
      metadata: {
        durationMs,
        pageTitle,
        sdkVersion,
        submittedVia: "capture-sdk",
      },
      priority: getOptionalString(formData, "priority"),
      title: getOptionalString(formData, "title"),
      url: getOptionalString(formData, "pageUrl"),
      visibility: getOptionalString(formData, "visibility"),
    })

    const result = await createBugReportRecord({
      input: createInput,
      organizationId: resolvedKey.organizationId,
      reporterId: null,
    })

    return buildJsonResponse(
      {
        debugger: result.debugger,
        id: result.id,
        reportId: result.id,
        shareUrl:
          createInput.visibility === "public"
            ? new URL(result.shareUrl, input.shareOrigin).toString()
            : undefined,
        warnings: result.warnings,
      },
      {
        headers: rateLimitDecision.headers,
      }
    )
  } catch (error) {
    return toErrorResponse(error)
  }
}
