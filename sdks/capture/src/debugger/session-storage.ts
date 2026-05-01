import { normalizeDebuggerEvent } from "@crikket/capture-core/debugger/normalize"
import type { DebuggerEvent } from "@crikket/capture-core/debugger/types"
import type { DebuggerSession } from "../types"

const STORAGE_KEY = "__crikketActiveSession"
const SESSION_VERSION = 1
const MAX_SESSION_AGE_MS = 5 * 60 * 1000

interface PersistedSession {
  version: typeof SESSION_VERSION
  sessionId: string
  captureType: "video" | "screenshot"
  startedAt: number
  recordingStartedAt: number | null
  events: DebuggerEvent[]
  savedAt: number
}

export interface RestoredSession {
  sessionId: string
  captureType: "video" | "screenshot"
  startedAt: number
  recordingStartedAt: number | null
  events: DebuggerEvent[]
}

export function persistSession(session: DebuggerSession): void {
  try {
    const persisted: PersistedSession = {
      version: SESSION_VERSION,
      sessionId: session.sessionId,
      captureType: session.captureType,
      startedAt: session.startedAt,
      recordingStartedAt: session.recordingStartedAt,
      events: session.events,
      savedAt: Date.now(),
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch {
  }
}

export function loadPersistedSession(): RestoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === null) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      clearPersistedSession()
      return null
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      clearPersistedSession()
      return null
    }

    const record = parsed as Record<string, unknown>

    if (record.version !== SESSION_VERSION) {
      clearPersistedSession()
      return null
    }

    const savedAt = record.savedAt
    if (
      typeof savedAt !== "number" ||
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > MAX_SESSION_AGE_MS
    ) {
      clearPersistedSession()
      return null
    }

    const { sessionId, captureType, startedAt, recordingStartedAt, events } =
      record

    if (
      typeof sessionId !== "string" ||
      !sessionId ||
      (captureType !== "video" && captureType !== "screenshot") ||
      typeof startedAt !== "number" ||
      !Number.isFinite(startedAt)
    ) {
      clearPersistedSession()
      return null
    }

    const normalizedEvents: DebuggerEvent[] = Array.isArray(events)
      ? events
          .map((e) => normalizeDebuggerEvent(e))
          .filter((e): e is DebuggerEvent => e !== null)
      : []

    return {
      sessionId,
      captureType,
      startedAt,
      recordingStartedAt:
        typeof recordingStartedAt === "number" ? recordingStartedAt : null,
      events: normalizedEvents,
    }
  } catch {
    return null
  }
}

export function clearPersistedSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
  }
}
