import {
  MAX_BODY_LENGTH,
  MAX_HEADER_NAME_LENGTH,
  MAX_HEADER_VALUE_LENGTH,
} from "../constants"
import { parseRawHeaders } from "../headers"
import { createStringifyValue } from "../serializer"
import {
  redactSensitiveQueryParams,
  sanitizeCapturedBody,
  shouldHideHeader,
  toAbsoluteUrl,
  truncate,
} from "../utils"
import { getRequestBodyPreviewAsync, scheduleBackgroundTask } from "./shared"
import type { NetworkCaptureInput, PostNetworkPayload } from "./types"

export const installXhrCapture = (input: NetworkCaptureInput): void => {
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

  const buildXhrPostPayload = async (
    xhr: XMLHttpRequest
  ): Promise<PostNetworkPayload | null> => {
    const state = xhrMetaMap.get(xhr)
    if (!state) {
      return null
    }

    const normalizedUrl = toAbsoluteUrl(state.url, reporter)
    if (!normalizedUrl) {
      return null
    }
    const redactedUrl = redactSensitiveQueryParams(normalizedUrl)

    let requestBody: string | undefined
    let responseBody: string | undefined
    const responseHeaders = parseRawHeaders(xhr.getAllResponseHeaders())
    const responseContentType = responseHeaders["content-type"] ?? ""
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

    return {
      method: state.method,
      url: redactedUrl,
      status: xhr.status,
      duration: Date.now() - state.startedAt,
      requestHeaders: state.requestHeaders,
      responseHeaders,
      requestBody: sanitizeCapturedBody(
        requestBody,
        state.requestHeaders["content-type"] ?? ""
      ),
      responseBody: sanitizeCapturedBody(responseBody, responseContentType),
    }
  }

  const postXhrLoadEndEvent = (xhr: XMLHttpRequest) => {
    scheduleBackgroundTask(reporter, async () => {
      const payload = await buildXhrPostPayload(xhr)
      if (!payload) {
        return
      }

      postNetwork(payload)
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
        stringifyValue,
        meta.requestHeaders["content-type"] ?? ""
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
