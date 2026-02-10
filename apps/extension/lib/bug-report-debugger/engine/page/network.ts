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

function installFetchCapture(input: NetworkCaptureInput): void {
  const { diagnostics, postNetwork, reporter } = input
  const stringifyValue = createStringifyValue(reporter)

  const bindFetch = (candidate: typeof window.fetch): typeof window.fetch => {
    return candidate.bind(window) as typeof window.fetch
  }

  if (typeof window.fetch !== "function") {
    diagnostics.setFetchHookState("failed")
    return
  }

  let delegateFetch = bindFetch(window.fetch)

  const patchedFetch = (async (...args: Parameters<typeof window.fetch>) => {
    diagnostics.recordFetchCall()
    const [requestInput, requestInit] = args
    const startedAt = Date.now()

    const method = resolveFetchMethod(requestInput, requestInit)
    const url = resolveFetchUrl(requestInput)
    const normalizedUrl = toAbsoluteUrl(url, reporter)

    if (!normalizedUrl) {
      return delegateFetch(...args)
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
    const requestBodyPromise = getFetchRequestBodyPreview(
      requestInput,
      requestInit,
      requestHeaderSource,
      stringifyValue,
      reporter
    )

    try {
      const response = await delegateFetch(...args)
      const duration = Date.now() - startedAt
      const responseHeaders = toHeaderRecord(response.headers)

      // Never delay the page's fetch lifecycle for debugger body capture.
      const postResponseEvent = async () => {
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
          const contentType = response.headers.get("content-type") ?? ""
          if (shouldCaptureTextContent(contentType)) {
            responseBody = truncate(
              await response.clone().text(),
              MAX_BODY_LENGTH
            )
          }
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
      }
      postResponseEvent().catch((error: unknown) => {
        reporter.reportNonFatalError(
          "Failed to post fetch network event in debugger instrumentation",
          error
        )
      })

      return response
    } catch (error) {
      diagnostics.recordFetchFailure(truncate(stringifyValue(error), 300))
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

      throw error
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
    requestBody?: string
    requestHeaders: Record<string, string>
  }

  const xhrMetaMap = new WeakMap<XMLHttpRequest, XhrMeta>()

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
      meta.requestBody = getRequestBodyPreview(args[0], stringifyValue)
    }

    this.addEventListener(
      "loadend",
      () => {
        const state = xhrMetaMap.get(this)
        if (!state) {
          return
        }

        const normalizedUrl = toAbsoluteUrl(state.url, reporter)
        if (!normalizedUrl) {
          return
        }

        let responseBody: string | undefined
        try {
          if (this.responseType === "" || this.responseType === "text") {
            responseBody = truncate(this.responseText || "", MAX_BODY_LENGTH)
          } else if (this.responseType === "json") {
            responseBody = truncate(
              stringifyValue(this.response),
              MAX_BODY_LENGTH
            )
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
          status: this.status,
          duration: Date.now() - state.startedAt,
          requestHeaders: state.requestHeaders,
          responseHeaders: parseRawHeaders(this.getAllResponseHeaders()),
          requestBody: state.requestBody,
          responseBody,
        })
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
