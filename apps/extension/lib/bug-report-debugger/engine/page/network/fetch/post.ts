import { MAX_BODY_LENGTH } from "../../constants"
import { toHeaderRecord } from "../../headers"
import { shouldCaptureTextContent } from "../../serializer"
import type { Reporter } from "../../types"
import { sanitizeCapturedBody, truncate } from "../../utils"
import { getTextBodyPreviewAsync, scheduleBackgroundTask } from "../shared"
import type { PostNetworkPayload } from "../types"
import type { FetchCaptureContext } from "./types"

const cloneFetchResponseForCapture = (
  response: Response,
  reporter: Reporter
): {
  contentType: string
  responseClone: Response | null
} => {
  const contentType = response.headers.get("content-type") ?? ""
  if (!shouldCaptureTextContent(contentType) || response.bodyUsed) {
    return {
      contentType,
      responseClone: null,
    }
  }

  try {
    return {
      contentType,
      responseClone: response.clone(),
    }
  } catch (error) {
    reporter.reportNonFatalError(
      "Failed to clone fetch response body in debugger instrumentation",
      error
    )
    return {
      contentType,
      responseClone: null,
    }
  }
}

export const scheduleFetchSuccessPost = (
  reporter: Reporter,
  postNetwork: (payload: PostNetworkPayload) => void,
  context: FetchCaptureContext,
  response: Response,
  duration: number
) => {
  const responseHeaders = toHeaderRecord(response.headers)
  const { contentType, responseClone } = cloneFetchResponseForCapture(
    response,
    reporter
  )

  scheduleBackgroundTask(reporter, async () => {
    let requestBody: string | undefined
    let responseBody: string | undefined

    try {
      requestBody = await context.requestBodyPromise
    } catch (error) {
      reporter.reportNonFatalError(
        "Failed to resolve fetch request body in debugger instrumentation",
        error
      )
    }

    try {
      responseBody = await getTextBodyPreviewAsync(
        reporter,
        contentType,
        "Failed to capture fetch response body text in debugger instrumentation",
        () => {
          if (!responseClone) {
            return Promise.resolve("")
          }

          return responseClone.text()
        }
      )
    } catch (error) {
      reporter.reportNonFatalError(
        "Failed to capture fetch response body in debugger instrumentation",
        error
      )
    }

    postNetwork({
      method: context.method,
      url: context.normalizedUrl,
      status: response.status,
      duration,
      requestHeaders: context.requestHeaders,
      responseHeaders,
      requestBody: sanitizeCapturedBody(
        requestBody,
        context.requestContentType
      ),
      responseBody: sanitizeCapturedBody(responseBody, contentType),
    })
  })
}

export const scheduleFetchFailurePost = (
  reporter: Reporter,
  postNetwork: (payload: PostNetworkPayload) => void,
  context: FetchCaptureContext,
  error: unknown,
  startedAt: number,
  stringifyValue: (value: unknown) => string
) => {
  scheduleBackgroundTask(reporter, async () => {
    let requestBody: string | undefined
    try {
      requestBody = await context.requestBodyPromise
    } catch (_requestBodyError) {
      requestBody = undefined
    }

    postNetwork({
      method: context.method,
      url: context.normalizedUrl,
      status: 0,
      duration: Date.now() - startedAt,
      requestHeaders: context.requestHeaders,
      requestBody: sanitizeCapturedBody(
        requestBody,
        context.requestContentType
      ),
      responseBody: sanitizeCapturedBody(
        truncate(stringifyValue(error), MAX_BODY_LENGTH),
        ""
      ),
    })
  })
}
