import type { BugReportDebuggerPayload } from "@crikket/capture-core/debugger/types"
import { ORPCError } from "@orpc/client"

const MAX_PAGE_TITLE_LENGTH = 300

export interface DebuggerCaptureSummary {
  actions: number
  logs: number
  networkRequests: number
}

export const EMPTY_DEBUGGER_SUMMARY: DebuggerCaptureSummary = {
  actions: 0,
  logs: 0,
  networkRequests: 0,
}

export function buildCaptureContextSubmissionData(input: {
  title?: string
  url?: string
}): {
  normalizedPageTitle: string | undefined
  normalizedUrl: string | undefined
  warnings: string[]
} {
  const warnings: string[] = []
  const normalizedUrl = normalizeOptionalUrl(input.url)
  if (input.url && !normalizedUrl) {
    warnings.push(
      "La URL de la página capturada era inválida y no se adjuntó a este reporte."
    )
  }

  const normalizedPageTitle = normalizeOptionalText(
    input.title,
    MAX_PAGE_TITLE_LENGTH
  )
  if (
    typeof input.title === "string" &&
    input.title.trim().length > MAX_PAGE_TITLE_LENGTH
  ) {
    warnings.push(
      "El título de la página capturada fue acortado antes de subir."
    )
  }

  return {
    normalizedPageTitle,
    normalizedUrl,
    warnings,
  }
}

export function getDebuggerCaptureSummary(
  payload: BugReportDebuggerPayload
): DebuggerCaptureSummary {
  return {
    actions: payload.actions.length,
    logs: payload.logs.length,
    networkRequests: payload.networkRequests.length,
  }
}

export function dedupeMessages(messages: string[]): string[] {
  return [...new Set(messages.map((entry) => entry.trim()).filter(Boolean))]
}

export function isUnauthorizedSubmissionError(error: unknown): boolean {
  return error instanceof ORPCError && error.code === "UNAUTHORIZED"
}

export function getSubmissionErrorMessage(error: unknown): string {
  if (error instanceof ORPCError) {
    const validationMessages = getValidationIssueMessages(error.data)
    if (validationMessages.length > 0) {
      return `Por favor corrige los campos del reporte: ${validationMessages.slice(0, 3).join(" | ")}`
    }

    if (isUnauthorizedSubmissionError(error)) {
      return "Sesión no autorizada. Inicia sesión nuevamente y reenvía el reporte."
    }

    if (error.code === "PAYLOAD_TOO_LARGE") {
      return "Este reporte es demasiado grande. Reintenta con una grabación más corta."
    }

    return error.message || "Error al enviar el reporte de error."
  }

  if (error instanceof Error) {
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("Direct upload to storage failed")
    ) {
      return "La subida directa al almacenamiento falló. Verifica la configuración CORS o el acceso a la red e intenta de nuevo."
    }

    return error.message
  }

  return "Error al enviar el reporte de error."
}

export function normalizeOptionalText(
  value: string | undefined,
  maxLength: number
): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  return trimmed.slice(0, maxLength)
}

function normalizeOptionalUrl(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalText(value, 4096)
  if (!normalized) {
    return undefined
  }

  try {
    return new URL(normalized).toString()
  } catch {
    return undefined
  }
}

function getValidationIssueMessages(errorData: unknown): string[] {
  if (!isRecord(errorData)) {
    return []
  }

  const rawIssues = errorData.issues
  if (!Array.isArray(rawIssues)) {
    return []
  }

  const messages: string[] = []

  for (const issue of rawIssues) {
    if (!isRecord(issue)) {
      continue
    }

    const message =
      typeof issue.message === "string" && issue.message.length > 0
        ? issue.message
        : "Invalid value"

    const path = formatIssuePath(issue.path)
    messages.push(path ? `${path}: ${message}` : message)
  }

  return dedupeMessages(messages)
}

function formatIssuePath(path: unknown): string | null {
  if (!Array.isArray(path) || path.length === 0) {
    return null
  }

  const segments = path
    .map((segment) => {
      if (typeof segment === "string" || typeof segment === "number") {
        return String(segment)
      }

      return null
    })
    .filter((segment): segment is string => Boolean(segment))

  return segments.length > 0 ? segments.join(".") : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
