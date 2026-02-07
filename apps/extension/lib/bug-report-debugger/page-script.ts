export function injectedDebuggerScript() {
  const PAGE_SOURCE = "CRIKKET_DEBUGGER_PAGE_BRIDGE"
  const INSTALL_FLAG = "__crikketDebuggerPageScriptInstalled"
  const MAX_TEXT_LENGTH = 2000
  const MAX_BODY_LENGTH = 4000

  const scope = window as Window & {
    [INSTALL_FLAG]?: boolean
  }

  if (scope[INSTALL_FLAG]) {
    return
  }

  scope[INSTALL_FLAG] = true

  const toRecord = (
    input: Headers | null | undefined
  ): Record<string, string> => {
    if (!input) return {}

    const result: Record<string, string> = {}

    for (const [key, value] of input.entries()) {
      result[key] = value.slice(0, 500)
    }

    return result
  }

  const truncate = (value: string, max = MAX_TEXT_LENGTH): string => {
    if (value.length <= max) return value
    return `${value.slice(0, max)}...`
  }

  const stringifyValue = (value: unknown): string => {
    if (typeof value === "string") {
      return truncate(value)
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      value === undefined
    ) {
      return String(value)
    }

    if (value instanceof Error) {
      const stack = value.stack ? `\n${truncate(value.stack)}` : ""
      return truncate(`${value.name}: ${value.message}${stack}`)
    }

    try {
      return truncate(JSON.stringify(value))
    } catch {
      return truncate(Object.prototype.toString.call(value))
    }
  }

  const getTargetSelector = (
    target: EventTarget | null
  ): string | undefined => {
    if (!(target instanceof Element)) return undefined

    if (target.id) {
      return `#${target.id}`
    }

    const classNames =
      typeof target.className === "string" ? target.className : ""
    const firstClass = classNames
      .split(" ")
      .map((entry) => entry.trim())
      .find((entry) => entry.length > 0)

    if (firstClass) {
      return `${target.tagName.toLowerCase()}.${firstClass}`
    }

    return target.tagName.toLowerCase()
  }

  const getRequestBodyPreview = (body: unknown): string | undefined => {
    if (!body) return undefined

    if (typeof body === "string") return truncate(body, MAX_BODY_LENGTH)

    if (body instanceof URLSearchParams) {
      return truncate(body.toString(), MAX_BODY_LENGTH)
    }

    if (typeof FormData !== "undefined" && body instanceof FormData) {
      const keys: string[] = []
      for (const key of body.keys()) {
        keys.push(key)
      }
      return truncate(`[form-data] ${keys.join(",")}`, MAX_BODY_LENGTH)
    }

    if (typeof Blob !== "undefined" && body instanceof Blob) {
      return `[blob:${body.type || "unknown"}:${body.size}]`
    }

    return truncate(Object.prototype.toString.call(body), MAX_BODY_LENGTH)
  }

  const postEvent = (event: unknown) => {
    window.postMessage(
      {
        source: PAGE_SOURCE,
        event,
      },
      "*"
    )
  }

  const postAction = (
    actionType: string,
    target: string | undefined,
    metadata?: Record<string, unknown>
  ) => {
    postEvent({
      kind: "action",
      timestamp: Date.now(),
      actionType,
      target,
      metadata,
    })
  }

  const postConsole = (
    level: "log" | "info" | "warn" | "error" | "debug",
    args: unknown[]
  ) => {
    const message = truncate(
      args.map((entry) => stringifyValue(entry)).join(" ")
    )
    postEvent({
      kind: "console",
      timestamp: Date.now(),
      level,
      message,
      metadata: {
        argumentCount: args.length,
      },
    })
  }

  const postNetwork = (payload: {
    method: string
    url: string
    status?: number
    duration?: number
    requestHeaders?: Record<string, string>
    responseHeaders?: Record<string, string>
    requestBody?: string
    responseBody?: string
  }) => {
    postEvent({
      kind: "network",
      timestamp: Date.now(),
      ...payload,
    })
  }

  const toAbsoluteUrl = (value: string): string | null => {
    try {
      return new URL(value, location.href).toString()
    } catch {
      return null
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = getTargetSelector(event.target)
      postAction("click", target)
    },
    true
  )

  document.addEventListener(
    "input",
    (event) => {
      const target = getTargetSelector(event.target)

      let valueLength: number | undefined
      const inputTarget = event.target
      if (
        inputTarget instanceof HTMLInputElement ||
        inputTarget instanceof HTMLTextAreaElement
      ) {
        valueLength = inputTarget.value.length
      }

      postAction("input", target, {
        valueLength,
      })
    },
    true
  )

  document.addEventListener(
    "change",
    (event) => {
      const target = getTargetSelector(event.target)
      postAction("change", target)
    },
    true
  )

  document.addEventListener(
    "submit",
    (event) => {
      const target = getTargetSelector(event.target)
      postAction("submit", target)
    },
    true
  )

  document.addEventListener(
    "keydown",
    (event) => {
      const target = getTargetSelector(event.target)
      const keyboardEvent = event as KeyboardEvent

      postAction("keydown", target, {
        key: keyboardEvent.key,
      })
    },
    true
  )

  const originalPushState = history.pushState
  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    postAction("navigation", "window", {
      mode: "pushState",
      url: location.href,
    })
  }

  const originalReplaceState = history.replaceState
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args)
    postAction("navigation", "window", {
      mode: "replaceState",
      url: location.href,
    })
  }

  window.addEventListener("popstate", () => {
    postAction("navigation", "window", {
      mode: "popstate",
      url: location.href,
    })
  })

  window.addEventListener("hashchange", () => {
    postAction("navigation", "window", {
      mode: "hashchange",
      url: location.href,
    })
  })

  postAction("navigation", "window", {
    mode: "initial",
    url: location.href,
  })

  const consoleLevels: Array<"log" | "info" | "warn" | "error" | "debug"> = [
    "log",
    "info",
    "warn",
    "error",
    "debug",
  ]

  for (const level of consoleLevels) {
    const original = console[level].bind(console)

    console[level] = (...args: unknown[]) => {
      try {
        postConsole(level, args)
      } catch {
        // Keep console behavior stable.
      }

      original(...args)
    }
  }

  const originalFetch = window.fetch
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: instrumentation needs explicit branching for successful/error responses.
  const patchedFetch = (async (...args: Parameters<typeof window.fetch>) => {
    const startedAt = Date.now()

    const [input, init] = args

    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET") ?? "GET"

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    const requestHeaders = init?.headers
      ? toRecord(new Headers(init.headers))
      : input instanceof Request
        ? toRecord(input.headers)
        : {}

    const normalizedUrl = toAbsoluteUrl(url)
    if (!normalizedUrl) {
      return originalFetch(...args)
    }

    const requestBody = getRequestBodyPreview(init?.body)

    try {
      const response = await originalFetch(...args)

      let responseBody: string | undefined
      try {
        const contentType = response.headers.get("content-type") ?? ""
        const shouldCaptureText =
          contentType.includes("json") ||
          contentType.includes("text") ||
          contentType.includes("xml")

        if (shouldCaptureText) {
          responseBody = truncate(
            await response.clone().text(),
            MAX_BODY_LENGTH
          )
        }
      } catch {
        responseBody = undefined
      }

      postNetwork({
        method,
        url: normalizedUrl,
        status: response.status,
        duration: Date.now() - startedAt,
        requestHeaders,
        responseHeaders: toRecord(response.headers),
        requestBody,
        responseBody,
      })

      return response
    } catch (error) {
      postNetwork({
        method,
        url: normalizedUrl,
        status: 0,
        duration: Date.now() - startedAt,
        requestHeaders,
        requestBody,
        responseBody: stringifyValue(error),
      })
      throw error
    }
  }) as typeof window.fetch

  Object.assign(patchedFetch, originalFetch)
  window.fetch = patchedFetch

  const parseRawHeaders = (rawHeaders: string): Record<string, string> => {
    const lines = rawHeaders.split("\n")
    const headers: Record<string, string> = {}

    for (const line of lines) {
      const normalizedLine = line.replace("\r", "")
      const separatorIndex = normalizedLine.indexOf(":")
      if (separatorIndex < 1) continue

      const key = normalizedLine.slice(0, separatorIndex).trim()
      const value = normalizedLine.slice(separatorIndex + 1).trim()
      if (!(key && value)) continue
      headers[key] = value.slice(0, 500)
    }

    return headers
  }

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
    const meta = xhrMetaMap.get(this)
    if (meta) {
      meta.requestHeaders[args[0]] = args[1].slice(0, 500)
    }

    return originalSetRequestHeader.apply(this, args)
  }

  const originalSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (
    ...args: Parameters<typeof originalSend>
  ) {
    const meta = xhrMetaMap.get(this)
    if (meta) {
      meta.startedAt = Date.now()
      meta.requestBody = getRequestBodyPreview(args[0])
    }

    this.addEventListener(
      "loadend",
      () => {
        const state = xhrMetaMap.get(this)
        if (!state) return

        let responseBody: string | undefined
        try {
          if (this.responseType === "" || this.responseType === "text") {
            responseBody = truncate(this.responseText || "", MAX_BODY_LENGTH)
          }
        } catch {
          responseBody = undefined
        }

        const normalizedUrl = toAbsoluteUrl(state.url)
        if (!normalizedUrl) return

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
}
