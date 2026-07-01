import {
  finalizeBugReportUpload,
  finalizeBugReportUploadInputSchema,
} from "@crikket/bug-reports/lib/upload-session"
import { ORPCError } from "@orpc/server"
import type { z } from "zod"
import {
  isCaptureSubmitProtectionEnabled,
  verifyCaptureFinalizeToken,
} from "./protection"
import {
  authorizeCaptureSubmitRequest,
  buildJsonResponse,
  toCaptureErrorResponse,
} from "./shared"

async function getRequestBody(
  request: Request
): Promise<z.infer<typeof finalizeBugReportUploadInputSchema>> {
  try {
    return finalizeBugReportUploadInputSchema.parse(
      (await request.json()) as unknown
    )
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Invalid JSON in capture finalize request.",
      })
    }

    throw error
  }
}

export async function handleCaptureFinalize(input: {
  request: Request
  shareOrigin: string
}): Promise<Response> {
  const route = "/api/embed/bug-report-finalize"
  let keyId: string | null = null
  let origin: string | null = null

  try {
    const authorization = await authorizeCaptureSubmitRequest({
      request: input.request,
      route,
    })
    if (authorization instanceof Response) {
      return authorization
    }

    keyId = authorization.keyId
    origin = authorization.origin

    const requestBody = await getRequestBody(input.request)
    if (isCaptureSubmitProtectionEnabled()) {
      const finalizeToken = input.request.headers
        .get("x-crikket-capture-finalize-token")
        ?.trim()
      if (!finalizeToken) {
        throw new ORPCError("UNAUTHORIZED", {
          data: {
            reasonCode: "missing_finalize_token",
          },
          message: "Capture finalize token is required.",
        })
      }

      await verifyCaptureFinalizeToken({
        keyId: authorization.publicKeyId,
        origin: authorization.origin,
        reportId: requestBody.id,
        token: finalizeToken,
      })
    }

    const result = await finalizeBugReportUpload({
      input: requestBody,
      organizationId: authorization.organizationId,
    })

    return buildJsonResponse(
      {
        debugger: result.debugger,
        id: result.id,
        reportId: result.id,
        shareUrl: new URL(result.shareUrl, input.shareOrigin).toString(),
        submissionStatus: result.submissionStatus,
        warnings: result.warnings,
      },
      {
        headers: authorization.rateLimitHeaders,
      }
    )
  } catch (error) {
    return toCaptureErrorResponse(error, {
      keyId,
      method: input.request.method,
      origin,
      route,
    })
  }
}
