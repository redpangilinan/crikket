import { MAX_TEXT_LENGTH } from "./constants"
import type { Reporter } from "./types"

export const truncate = (
  value: string,
  maxLength = MAX_TEXT_LENGTH
): string => {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...`
}

export const shouldHideHeader = (headerName: string): boolean => {
  return headerName.includes("debugger")
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
