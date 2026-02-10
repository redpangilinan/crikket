import {
  MAX_BODY_LENGTH,
  MAX_HEADER_NAME_LENGTH,
  MAX_HEADER_VALUE_LENGTH,
} from "./constants"
import type { PageDiagnostics } from "./diagnostics"
import { parseRawHeaders, toHeaderRecord } from "./headers"
import {
  createStringifyValue,
  getRequestBodyPreview,
  shouldCaptureTextContent,
} from "./serializer"
import type { Reporter } from "./types"
import { shouldHideHeader, toAbsoluteUrl, truncate } from "./utils"

interface PostNetworkPayload {
  method: string
  url: string
  status?: number
  duration?: number
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBody?: string
  responseBody?: string
}

interface NetworkCaptureInput {
  reporter: Reporter
  diagnostics: Pick<
    PageDiagnostics,
    | "recordFetchCall"
    | "recordFetchFailure"
    | "setFetchHookState"
    | "recordXhrCall"
    | "setXhrHookInstalled"
  >
  postNetwork: (payload: PostNetworkPayload) => void
}

const scheduleBackgroundTask = (
  reporter: Reporter,
  task: () => void | Promise<void>
): void => {
  const executeTask = () => {
    Promise.resolve(task()).catch((error: unknown) => {
      reporter.reportNonFatalError(
        "Background debugger instrumentation task failed",
        error
      )
    })
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => {
      executeTask()
    })
    return
  }

  window.setTimeout(executeTask, 0)
}

function resolveFetchMethod(
  input: RequestInfo | URL,
  init: RequestInit | undefined
): string {
  if (typeof init?.method === "string" && init.method) {
    return init.method.toUpperCase()
  }

  if (input instanceof Request) {
    return input.method.toUpperCase()
  }

  return "GET"
}

function resolveFetchUrl(input: RequestInfo | URL): string {
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
    return truncate(await input.clone().text(), MAX_BODY_LENGTH)
  } catch (error) {
    reporter.reportNonFatalError(
      "Failed to capture fetch request body in debugger instrumentation",
      error
    )
    return undefined
  }
}

const getRequestBodyPreviewAsync = (
  reporter: Reporter,
  body: unknown,
  stringifyValue: (value: unknown) => string
): Promise<string | undefined> => {
  return new Promise((resolve) => {
    scheduleBackgroundTask(reporter, () => {
      resolve(getRequestBodyPreview(body, stringifyValue))
    })
  })
}

const getTextBodyPreviewAsync = (
  reporter: Reporter,
  contentType: string,
  errorContext: string,
  readBody: () => Promise<string>
): Promise<string | undefined> => {
  return new Promise((resolve) => {
    scheduleBackgroundTask(reporter, async () => {
      if (!shouldCaptureTextContent(contentType)) {
        resolve(undefined)
        return
      }

      try {
        resolve(truncate(await readBody(), MAX_BODY_LENGTH))
      } catch (error) {
        reporter.reportNonFatalError(errorContext, error)
        resolve(undefined)
      }
    })
  })
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

function installFetchCapture(input: NetworkCaptureInput): void {
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
                stringifyValue
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
    const [requestInput, requestInit] = args
    const startedAt = Date.now()

    const method = resolveFetchMethod(requestInput, requestInit)
    const url = resolveFetchUrl(requestInput)
    const normalizedUrl = toAbsoluteUrl(url, reporter)

    if (!normalizedUrl) {
      try {
        return delegateFetch(...args)
      } finally {
        isInsidePatchedFetch = false
      }
    }

    let requestHeaders: Record<string, string>

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

    if (requestHeaderSource) {
      requestHeaders = toHeaderRecord(requestHeaderSource)
    } else {
      requestHeaders =
        requestInput instanceof Request
          ? toHeaderRecord(requestInput.headers)
          : {}
    }
    const requestBodyPromise = resolveFetchRequestBodyPromise(
      requestInput,
      requestInit,
      requestHeaderSource,
      stringifyValue,
      reporter,
      requestBodyByRequest
    )

    try {
      const response = await delegateFetch(...args)
      const duration = Date.now() - startedAt
      const responseHeaders = toHeaderRecord(response.headers)
      const { contentType, responseClone } = cloneFetchResponseForCapture(
        response,
        reporter
      )

      // Never delay the page's fetch lifecycle for debugger capture.
      scheduleBackgroundTask(reporter, async () => {
        let requestBody: string | undefined
        let responseBody: string | undefined

        try {
          requestBody = await requestBodyPromise
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
          method,
          url: normalizedUrl,
          status: response.status,
          duration,
          requestHeaders,
          responseHeaders,
          requestBody,
          responseBody,
        })
      })

      return response
    } catch (error) {
      diagnostics.recordFetchFailure(truncate(stringifyValue(error), 300))
      scheduleBackgroundTask(reporter, async () => {
        let requestBody: string | undefined
        try {
          requestBody = await requestBodyPromise
        } catch (_requestBodyError) {
          requestBody = undefined
        }

        postNetwork({
          method,
          url: normalizedUrl,
          status: 0,
          duration: Date.now() - startedAt,
          requestHeaders,
          requestBody,
          responseBody: truncate(stringifyValue(error), MAX_BODY_LENGTH),
        })
      })

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

function installXhrCapture(input: NetworkCaptureInput): void {
  const { diagnostics, postNetwork, reporter } = input
  const stringifyValue = createStringifyValue(reporter)

  type XhrMeta = {
    method: string
    url: string
    startedAt: number
    requestBodyPromise: Promise<string | undefined>
    requestHeaders: Record<string, string>
  }

  const xhrMetaMap = new WeakMap<XMLHttpRequest, XhrMeta>()

  const postXhrLoadEndEvent = (xhr: XMLHttpRequest) => {
    scheduleBackgroundTask(reporter, async () => {
      const state = xhrMetaMap.get(xhr)
      if (!state) {
        return
      }

      const normalizedUrl = toAbsoluteUrl(state.url, reporter)
      if (!normalizedUrl) {
        return
      }

      let requestBody: string | undefined
      let responseBody: string | undefined
      try {
        requestBody = await state.requestBodyPromise
      } catch (_requestBodyError) {
        requestBody = undefined
      }

      try {
        if (xhr.responseType === "" || xhr.responseType === "text") {
          responseBody = truncate(xhr.responseText || "", MAX_BODY_LENGTH)
        } else if (xhr.responseType === "json") {
          responseBody = truncate(stringifyValue(xhr.response), MAX_BODY_LENGTH)
        }
      } catch (error) {
        reporter.reportNonFatalError(
          "Failed to capture XHR response body in debugger instrumentation",
          error
        )
      }

      postNetwork({
        method: state.method,
        url: normalizedUrl,
        status: xhr.status,
        duration: Date.now() - state.startedAt,
        requestHeaders: state.requestHeaders,
        responseHeaders: parseRawHeaders(xhr.getAllResponseHeaders()),
        requestBody,
        responseBody,
      })
    })
  }

  const originalOpen = XMLHttpRequest.prototype.open
  const openWithOptionalArgs = originalOpen as unknown as (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) => void

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    const normalizedMethod = typeof method === "string" ? method : "GET"
    const normalizedUrl = typeof url === "string" ? url : String(url ?? "")

    xhrMetaMap.set(this, {
      method: normalizedMethod,
      url: normalizedUrl,
      startedAt: Date.now(),
      requestBodyPromise: Promise.resolve(undefined),
      requestHeaders: {},
    })

    if (
      typeof async === "boolean" ||
      typeof username === "string" ||
      username === null ||
      typeof password === "string" ||
      password === null
    ) {
      return openWithOptionalArgs.call(
        this,
        method,
        url,
        async ?? true,
        username,
        password
      )
    }

    return openWithOptionalArgs.call(this, method, url)
  }

  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader
  XMLHttpRequest.prototype.setRequestHeader = function (
    ...args: Parameters<typeof originalSetRequestHeader>
  ) {
    const [key, value] = args
    const meta = xhrMetaMap.get(this)

    if (meta) {
      const normalizedKey = key.trim().toLowerCase()
      if (!shouldHideHeader(normalizedKey)) {
        meta.requestHeaders[normalizedKey.slice(0, MAX_HEADER_NAME_LENGTH)] =
          value.slice(0, MAX_HEADER_VALUE_LENGTH)
      }
    }

    return originalSetRequestHeader.apply(this, args)
  }

  const originalSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (
    ...args: Parameters<typeof originalSend>
  ) {
    diagnostics.recordXhrCall()
    const meta = xhrMetaMap.get(this)
    if (meta) {
      meta.startedAt = Date.now()
      meta.requestBodyPromise = getRequestBodyPreviewAsync(
        reporter,
        args[0],
        stringifyValue
      )
    }

    this.addEventListener(
      "loadend",
      () => {
        postXhrLoadEndEvent(this)
      },
      {
        once: true,
      }
    )

    return originalSend.apply(this, args)
  }

  diagnostics.setXhrHookInstalled()
}

export function installNetworkCapture(input: NetworkCaptureInput): void {
  installFetchCapture(input)
  installXhrCapture(input)
}
