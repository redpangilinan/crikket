import { MAX_HEADER_NAME_LENGTH, MAX_HEADER_VALUE_LENGTH } from "./constants"
import { shouldHideHeader } from "./utils"

export const toHeaderRecord = (
  input: Headers | null | undefined
): Record<string, string> => {
  if (!input) {
    return {}
  }

  const result: Record<string, string> = {}
  for (const [key, value] of input.entries()) {
    const normalizedKey = key.trim().toLowerCase()
    if (!normalizedKey || shouldHideHeader(normalizedKey)) {
      continue
    }

    result[normalizedKey.slice(0, MAX_HEADER_NAME_LENGTH)] = value.slice(
      0,
      MAX_HEADER_VALUE_LENGTH
    )
  }

  return result
}

export const parseRawHeaders = (rawHeaders: string): Record<string, string> => {
  const result: Record<string, string> = {}
  const lines = rawHeaders.split("\n")

  for (const line of lines) {
    const normalizedLine = line.replace("\r", "")
    const separatorIndex = normalizedLine.indexOf(":")
    if (separatorIndex <= 0) {
      continue
    }

    const key = normalizedLine.slice(0, separatorIndex).trim().toLowerCase()
    if (!key || shouldHideHeader(key)) {
      continue
    }

    const value = normalizedLine.slice(separatorIndex + 1).trim()
    if (!value) {
      continue
    }

    result[key.slice(0, MAX_HEADER_NAME_LENGTH)] = value.slice(
      0,
      MAX_HEADER_VALUE_LENGTH
    )
  }

  return result
}
