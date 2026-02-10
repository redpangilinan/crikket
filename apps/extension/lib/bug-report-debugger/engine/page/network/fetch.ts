import { MAX_BODY_LENGTH } from "../constants"
import { toHeaderRecord } from "../headers"
import {
  createStringifyValue,
  getRequestBodyPreview,
  shouldCaptureTextContent,
} from "../serializer"
import type { Reporter } from "../types"
import {
  redactSensitiveQueryParams,
  sanitizeCapturedBody,
  toAbsoluteUrl,
  truncate,
} from "../utils"
import {
  getRequestBodyPreviewAsync,
  getTextBodyPreviewAsync,
  scheduleBackgroundTask,
} from "./shared"
import type { NetworkCaptureInput, PostNetworkPayload } from "./types"

const resolveFetchMethod = (
  input: RequestInfo | URL,
  init: RequestInit | undefined
): string => {
  if (typeof init?.method === "string" && init.method) {
    return init.method.toUpperCase()
  }

  if (input instanceof Request) {
    return input.method.toUpperCase()
  }

  return "GET"
}

const resolveFetchUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

const getFetchRequestBodyPreview = async (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  requestHeaders: Headers | null,
  stringifyValue: (value: unknown) => string,
  reporter: Reporter
): Promise<string | undefined> => {
  const initBodyPreview = getRequestBodyPreview(init?.body, stringifyValue)
  if (initBodyPreview) {
    return initBodyPreview
  }

  if (!(input instanceof Request)) {
    return undefined
  }

  const method = (init?.method ?? input.method ?? "GET").toUpperCase()
  if (method === "GET" || method === "HEAD" || input.bodyUsed) {
    return undefined
  }

  const contentType =
    requestHeaders?.get("content-type") ??
    input.headers.get("content-type") ??
    ""

  if (!shouldCaptureTextContent(contentType)) {
    return undefined
  }

  try {
    return sanitizeCapturedBody(
      truncate(await input.clone().text(), MAX_BODY_LENGTH),
      contentType
    )
  } catch (error) {
    reporter.reportNonFatalError(
      "Failed to capture fetch request body in debugger instrumentation",
      error
    )
    return undefined
  }
}

const resolveFetchRequestBodyPromise = (
  requestInput: RequestInfo | URL,
  requestInit: RequestInit | undefined,
  requestHeaderSource: Headers | null,
  stringifyValue: (value: unknown) => string,
  reporter: Reporter,
  requestBodyByRequest: WeakMap<Request, Promise<string | undefined>>
): Promise<string | undefined> => {
  if (requestInput instanceof Request) {
    return (
      requestBodyByRequest.get(requestInput) ??
      getFetchRequestBodyPreview(
        requestInput,
        requestInit,
        requestHeaderSource,
        stringifyValue,
        reporter
      )
    )
  }

  return getFetchRequestBodyPreview(
    requestInput,
    requestInit,
    requestHeaderSource,
    stringifyValue,
    reporter
  )
}

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

interface FetchCaptureContext {
  method: string
  normalizedUrl: string
  requestHeaders: Record<string, string>
  requestContentType: string
  requestBodyPromise: Promise<string | undefined>
}

const resolveFetchContext = (
  args: Parameters<typeof window.fetch>,
  reporter: Reporter,
  stringifyValue: (value: unknown) => string,
  requestBodyByRequest: WeakMap<Request, Promise<string | undefined>>
): FetchCaptureContext | null => {
  const [requestInput, requestInit] = args
  const method = resolveFetchMethod(requestInput, requestInit)
  const url = resolveFetchUrl(requestInput)
  const absoluteUrl = toAbsoluteUrl(url, reporter)
  if (!absoluteUrl) {
    return null
  }

  let requestHeaderSource: Headers | null = null
  if (requestInit?.headers) {
    try {
      requestHeaderSource = new Headers(requestInit.headers)
    } catch (error) {
      reporter.reportNonFatalError(
        "Failed to normalize fetch headers in debugger instrumentation",
        error
      )
    }
  } else if (requestInput instanceof Request) {
    requestHeaderSource = requestInput.headers
  }

  const requestHeaders = requestHeaderSource
    ? toHeaderRecord(requestHeaderSource)
    : requestInput instanceof Request
      ? toHeaderRecord(requestInput.headers)
      : {}

  const requestContentType =
    requestHeaderSource?.get("content-type") ??
    (requestInput instanceof Request
      ? (requestInput.headers.get("content-type") ?? "")
      : "")

  const requestBodyPromise = resolveFetchRequestBodyPromise(
    requestInput,
    requestInit,
    requestHeaderSource,
    stringifyValue,
    reporter,
    requestBodyByRequest
  )

  return {
    method,
    normalizedUrl: redactSensitiveQueryParams(absoluteUrl),
    requestHeaders,
    requestContentType,
    requestBodyPromise,
  }
}

const scheduleFetchSuccessPost = (
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

const scheduleFetchFailurePost = (
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

export const installFetchCapture = (input: NetworkCaptureInput): void => {
  const { diagnostics, postNetwork, reporter } = input
  const stringifyValue = createStringifyValue(reporter)
  const requestBodyByRequest = new WeakMap<
    Request,
    Promise<string | undefined>
  >()

  const bindFetch = (candidate: typeof window.fetch): typeof window.fetch => {
    return candidate.bind(window) as typeof window.fetch
  }

  if (typeof window.Request === "function") {
    const OriginalRequest = window.Request
    const patchedRequest = new Proxy(OriginalRequest, {
      construct(target, argArray, newTarget) {
        const [, requestInit] = argArray as [
          RequestInfo | URL,
          RequestInit | undefined,
        ]
        const requestInstance = Reflect.construct(
          target,
          argArray,
          newTarget
        ) as Request

        let requestHeaderSource: Headers
        if (requestInit?.headers !== undefined) {
          try {
            requestHeaderSource = new Headers(requestInit.headers)
          } catch (error) {
            reporter.reportNonFatalError(
              "Failed to normalize Request headers in debugger instrumentation",
              error
            )
            requestHeaderSource = requestInstance.headers
          }
        } else {
          requestHeaderSource = requestInstance.headers
        }

        const contentType = requestHeaderSource.get("content-type") ?? ""

        const requestBodyPromise =
          requestInit?.body !== undefined
            ? getRequestBodyPreviewAsync(
                reporter,
                requestInit.body,
                stringifyValue,
                contentType
              )
            : getTextBodyPreviewAsync(
                reporter,
                contentType,
                "Failed to capture Request body text in debugger instrumentation",
                () => {
                  if (requestInstance.bodyUsed) {
                    return Promise.resolve("")
                  }

                  return requestInstance.clone().text()
                }
              )

        requestBodyByRequest.set(requestInstance, requestBodyPromise)
        return requestInstance
      },
    })

    try {
      Object.assign(patchedRequest, OriginalRequest)
    } catch (error) {
      reporter.reportNonFatalError(
        "Failed to mirror Request constructor properties in debugger instrumentation",
        error
      )
    }

    try {
      window.Request = patchedRequest as typeof Request
    } catch (error) {
      reporter.reportNonFatalError(
        "Failed to patch Request constructor in debugger instrumentation",
        error
      )
    }
  }

  if (typeof window.fetch !== "function") {
    diagnostics.setFetchHookState("failed")
    return
  }

  const baseFetch = bindFetch(window.fetch)
  let delegateFetch = baseFetch
  let isInsidePatchedFetch = false

  const patchedFetch = (async (...args: Parameters<typeof window.fetch>) => {
    if (isInsidePatchedFetch) {
      // Prevent recursion when third-party fetch wrappers call window.fetch().
      return baseFetch(...args)
    }

    isInsidePatchedFetch = true
    diagnostics.recordFetchCall()
    const startedAt = Date.now()
    const context = resolveFetchContext(
      args,
      reporter,
      stringifyValue,
      requestBodyByRequest
    )
    if (!context) {
      try {
        return delegateFetch(...args)
      } finally {
        isInsidePatchedFetch = false
      }
    }

    try {
      const response = await delegateFetch(...args)
      const duration = Date.now() - startedAt
      scheduleFetchSuccessPost(
        reporter,
        postNetwork,
        context,
        response,
        duration
      )
      return response
    } catch (error) {
      diagnostics.recordFetchFailure(truncate(stringifyValue(error), 300))
      scheduleFetchFailurePost(
        reporter,
        postNetwork,
        context,
        error,
        startedAt,
        stringifyValue
      )
      throw error
    } finally {
      isInsidePatchedFetch = false
    }
  }) as typeof window.fetch

  try {
    Object.assign(patchedFetch, window.fetch)
  } catch (error) {
    reporter.reportNonFatalError(
      "Failed to mirror fetch properties in debugger instrumentation",
      error
    )
  }

  const fetchDescriptor = Object.getOwnPropertyDescriptor(window, "fetch")
  const canRedefineFetch = !fetchDescriptor || fetchDescriptor.configurable

  if (canRedefineFetch) {
    try {
      Object.defineProperty(window, "fetch", {
        configurable: true,
        enumerable: fetchDescriptor?.enumerable ?? true,
        get() {
          return patchedFetch
        },
        set(nextFetch: unknown) {
          if (typeof nextFetch !== "function") {
            return
          }

          if (nextFetch === patchedFetch) {
            return
          }

          delegateFetch = bindFetch(nextFetch as typeof window.fetch)
        },
      })
      diagnostics.setFetchHookState("accessor")
      return
    } catch (error) {
      reporter.reportNonFatalError(
        "Failed to install fetch accessor in debugger instrumentation",
        error
      )
    }
  }

  try {
    window.fetch = patchedFetch
    diagnostics.setFetchHookState("assignment")
  } catch (error) {
    diagnostics.setFetchHookState("failed")
    reporter.reportNonFatalError(
      "Failed to patch fetch in debugger instrumentation",
      error
    )
  }
}
