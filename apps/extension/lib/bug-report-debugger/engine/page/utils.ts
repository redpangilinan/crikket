import { MAX_TEXT_LENGTH } from "./constants"
import type { Reporter } from "./types"

const REDACTED_VALUE = "[REDACTED]"
const SENSITIVE_NAME_PATTERNS = [
  "authorization",
  "cookie",
  "set-cookie",
  "token",
  "secret",
  "password",
  "passwd",
  "pwd",
  "session",
  "api-key",
  "apikey",
  "x-api-key",
  "refresh-token",
  "refresh_token",
  "access-token",
  "access_token",
  "id-token",
  "id_token",
  "client-secret",
  "client_secret",
] as const

const REDACTABLE_FIELD_PATTERN =
  /((?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|password|passwd|pwd|authorization|cookie|session[_-]?id)\s*[:=]\s*)([^&\s",;]+)/gi

export const truncate = (
  value: string,
  maxLength = MAX_TEXT_LENGTH
): string => {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...`
}

export const isSensitiveName = (value: string): boolean => {
  const normalizedValue = value.trim().toLowerCase()
  if (!normalizedValue) {
    return false
  }

  return SENSITIVE_NAME_PATTERNS.some((pattern) => {
    return normalizedValue.includes(pattern)
  })
}

export const shouldHideHeader = (headerName: string): boolean => {
  return headerName.includes("debugger") || isSensitiveName(headerName)
}

export const getElementTarget = (
  target: EventTarget | null
): string | undefined => {
  if (!(target instanceof Element)) {
    return undefined
  }

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

export const toAbsoluteUrl = (
  value: string,
  reporter: Reporter
): string | null => {
  try {
    return new URL(value, location.href).toString()
  } catch (error) {
    reporter.reportNonFatalError(
      "Failed to normalize network URL in debugger instrumentation",
      {
        error,
        value,
      }
    )
    return null
  }
}

export const redactSensitiveQueryParams = (absoluteUrl: string): string => {
  try {
    const parsedUrl = new URL(absoluteUrl)
    for (const [key] of parsedUrl.searchParams.entries()) {
      if (!isSensitiveName(key)) {
        continue
      }

      parsedUrl.searchParams.set(key, REDACTED_VALUE)
    }

    return parsedUrl.toString()
  } catch {
    return absoluteUrl
  }
}

const sanitizeStructuredValue = (value: unknown, depth = 0): unknown => {
  if (depth >= 6) {
    return "[MaxDepth]"
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStructuredValue(item, depth + 1))
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      if (isSensitiveName(key)) {
        result[key] = REDACTED_VALUE
        continue
      }

      result[key] = sanitizeStructuredValue(nestedValue, depth + 1)
    }

    return result
  }

  if (typeof value === "string") {
    return value.replace(REDACTABLE_FIELD_PATTERN, `$1${REDACTED_VALUE}`)
  }

  return value
}

const sanitizeUrlEncodedBody = (body: string): string => {
  const params = new URLSearchParams(body)
  for (const [key] of params.entries()) {
    if (!isSensitiveName(key)) {
      continue
    }

    params.set(key, REDACTED_VALUE)
  }

  return params.toString()
}

export const sanitizeCapturedBody = (
  body: string | undefined,
  contentType: string
): string | undefined => {
  if (typeof body !== "string" || body.length === 0) {
    return body
  }

  const normalizedContentType = contentType.toLowerCase()
  if (normalizedContentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(body) as unknown
      return truncate(
        JSON.stringify(sanitizeStructuredValue(parsed)),
        MAX_TEXT_LENGTH * 2
      )
    } catch {
      return truncate(
        body.replace(REDACTABLE_FIELD_PATTERN, `$1${REDACTED_VALUE}`),
        MAX_TEXT_LENGTH * 2
      )
    }
  }

  if (normalizedContentType.includes("x-www-form-urlencoded")) {
    return truncate(sanitizeUrlEncodedBody(body), MAX_TEXT_LENGTH * 2)
  }

  return truncate(
    body.replace(REDACTABLE_FIELD_PATTERN, `$1${REDACTED_VALUE}`),
    MAX_TEXT_LENGTH * 2
  )
}

export function createNonFatalReporter(): Reporter {
  const originalConsoleWarn = console.warn.bind(console)
  const reportedContexts = new Set<string>()

  return {
    reportNonFatalError(context, error) {
      if (reportedContexts.has(context)) {
        return
      }

      reportedContexts.add(context)
      originalConsoleWarn(`[Non-fatal] ${context}`, error)
    },
  }
}
