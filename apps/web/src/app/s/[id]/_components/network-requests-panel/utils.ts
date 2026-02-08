import { reportNonFatalError } from "@crikket/shared/lib/errors"
import type { BodyPreview, DetailSection, KeyValueItem } from "./types"

const FORM_DATA_PATTERN = /^[^=&?#]+=[^=&]*(&[^=&?#]+=[^=&]*)*$/

export const DETAIL_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "request", label: "Request" },
  { id: "response", label: "Response" },
] as const satisfies ReadonlyArray<{ id: DetailSection; label: string }>

export function safeParseUrl(value: string | undefined): URL | null {
  if (!value) {
    return null
  }

  try {
    return new URL(value)
  } catch (error) {
    reportNonFatalError(
      "Failed to parse network request URL",
      { error, value },
      {
        once: true,
      }
    )
    return null
  }
}

export function statusTone(status: number): string {
  if (status >= 200 && status < 300) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  }

  if (status >= 300 && status < 400) {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300"
  }

  if (status >= 400 && status < 500) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  if (status >= 500) {
    return "bg-red-500/10 text-red-700 dark:text-red-300"
  }

  return "bg-muted text-muted-foreground"
}

export function asKeyValueItems(
  value: Record<string, string> | null
): KeyValueItem[] {
  if (!value) {
    return []
  }

  return Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entryValue], index) => {
      return { id: `${key}-${index}`, key, value: entryValue }
    })
}

export function getQueryParams(url: string): KeyValueItem[] {
  const parsedUrl = safeParseUrl(url)
  if (!parsedUrl) {
    return []
  }

  const params: KeyValueItem[] = []
  let index = 0

  for (const [key, value] of parsedUrl.searchParams.entries()) {
    params.push({ id: `${key}-${index}`, key, value })
    index += 1
  }

  return params
}

export function getBodyParams(requestBody: string | null): KeyValueItem[] {
  if (!requestBody) {
    return []
  }

  const trimmed = requestBody.trim()
  if (!trimmed) {
    return []
  }

  const jsonParams = parseJsonParams(trimmed)
  if (jsonParams.length > 0) {
    return jsonParams
  }

  const formParams = parseFormParams(trimmed)
  if (formParams.length > 0) {
    return formParams
  }

  return []
}

export function formatBody(value: string | null): BodyPreview | null {
  if (!value) {
    return null
  }

  const raw = value.trim()
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    return {
      raw,
      formatted: JSON.stringify(parsed, null, 2),
    }
  } catch (error) {
    reportNonFatalError("Failed to format request payload as JSON", error, {
      once: true,
    })
    return { raw, formatted: raw }
  }
}

function parseJsonParams(value: string): KeyValueItem[] {
  try {
    const parsed = JSON.parse(value)
    if (!isRecord(parsed)) {
      return []
    }

    return Object.entries(parsed).map(([key, entryValue], index) => {
      return {
        id: `${key}-${index}`,
        key,
        value: stringifyScalar(entryValue),
      }
    })
  } catch (error) {
    reportNonFatalError("Failed to parse request body params as JSON", error, {
      once: true,
    })
    return []
  }
}

function parseFormParams(value: string): KeyValueItem[] {
  const looksLikeFormData = FORM_DATA_PATTERN.test(value)
  if (!looksLikeFormData) {
    return []
  }

  const params = new URLSearchParams(value)
  const result: KeyValueItem[] = []
  let index = 0

  for (const [key, entryValue] of params.entries()) {
    result.push({ id: `${key}-${index}`, key, value: entryValue })
    index += 1
  }

  return result
}

function stringifyScalar(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch (error) {
    reportNonFatalError(
      "Failed to stringify non-scalar request body param value",
      error,
      { once: true }
    )
    return "[unserializable]"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
