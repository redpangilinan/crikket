import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { DEBUGGER_SESSIONS_STORAGE_KEY } from "../../constants"
import { normalizeDebuggerEvent, normalizeStoredSession } from "../../normalize"
import type {
  DebuggerEvent,
  DebuggerSessionSnapshot,
  StoredDebuggerSession,
} from "../../types"
import {
  createSessionId,
  injectDebuggerScriptIntoTab,
  isInjectablePageUrl,
} from "./injection"
import {
  appendActionEventWithDedup,
  appendEventWithRetentionPolicy,
  appendNetworkEventWithDedup,
} from "./retention"

interface StartSessionPayload {
  captureTabId: number
  captureType: "video" | "screenshot"
}

interface MarkRecordingStartedPayload {
  sessionId: string
  recordingStartedAt: number
}

interface DebuggerSessionStore {
  injectDebuggerScriptForTab: (tabId: number) => Promise<void>
  startSession: (payload: StartSessionPayload) => Promise<{
    sessionId: string
    startedAt: number
  }>
  appendPageEvents: (tabId: number, rawEvents: unknown[]) => Promise<void>
  getSessionSnapshot: (
    sessionId: string
  ) => Promise<DebuggerSessionSnapshot | null>
  markSessionRecordingStarted: (
    payload: MarkRecordingStartedPayload
  ) => Promise<void>
  discardSession: (sessionId: string) => Promise<void>
  ensureDebuggerScriptForTab: (tabId: number, url?: string) => Promise<void>
  discardSessionByTabId: (tabId: number) => Promise<void>
}

export function createDebuggerSessionStore(): DebuggerSessionStore {
  const sessionsById = new Map<string, StoredDebuggerSession>()
  const tabToSession = new Map<number, string>()

  let isLoaded = false
  let loadPromise: Promise<void> | null = null
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  const schedulePersist = () => {
    if (persistTimer) {
      return
    }

    persistTimer = setTimeout(() => {
      persistTimer = null
      persistState().catch((error: unknown) => {
        reportNonFatalError("Failed to persist debugger state", error)
      })
    }, 250)
  }

  const persistState = async () => {
    const sessionsSnapshot = Array.from(sessionsById.values())

    await chrome.storage.local.set({
      [DEBUGGER_SESSIONS_STORAGE_KEY]: sessionsSnapshot,
    })
  }

  const hydrateStoredState = async () => {
    const result = await chrome.storage.local.get([
      DEBUGGER_SESSIONS_STORAGE_KEY,
    ])
    const storedSessions = result[DEBUGGER_SESSIONS_STORAGE_KEY]

    if (!Array.isArray(storedSessions)) {
      return
    }

    for (const candidate of storedSessions) {
      const session = normalizeStoredSession(candidate)
      if (!session) {
        continue
      }

      sessionsById.set(session.sessionId, session)
      tabToSession.set(session.captureTabId, session.sessionId)
    }
  }

  const ensureLoaded = async () => {
    if (isLoaded) {
      return
    }

    if (loadPromise) {
      await loadPromise
      return
    }

    loadPromise = hydrateStoredState()
      .catch((error: unknown) => {
        reportNonFatalError("Failed to load debugger state from storage", error)
      })
      .finally(() => {
        isLoaded = true
        loadPromise = null
      })

    await loadPromise
  }

  const removeSession = (sessionId: string) => {
    const session = sessionsById.get(sessionId)
    if (!session) {
      return
    }

    sessionsById.delete(sessionId)

    const activeSessionId = tabToSession.get(session.captureTabId)
    if (activeSessionId === sessionId) {
      tabToSession.delete(session.captureTabId)
    }
  }

  const appendEventsToSession = (
    tabId: number,
    events: DebuggerEvent[]
  ): void => {
    if (events.length === 0) {
      return
    }

    const sessionId = tabToSession.get(tabId)
    const session = sessionId ? sessionsById.get(sessionId) : undefined
    if (!session) {
      return
    }

    for (const event of events) {
      if (event.kind === "network") {
        appendNetworkEventWithDedup(session.events, event)
      } else if (event.kind === "action") {
        appendActionEventWithDedup(session.events, event)
      } else {
        appendEventWithRetentionPolicy(session.events, event)
      }
    }

    schedulePersist()
  }

  const startSession = async (payload: StartSessionPayload) => {
    await ensureLoaded()

    const startedAt = Date.now()
    const sessionId = createSessionId()

    const session: StoredDebuggerSession = {
      sessionId,
      captureTabId: payload.captureTabId,
      captureType: payload.captureType,
      startedAt,
      recordingStartedAt:
        payload.captureType === "screenshot" ? startedAt : null,
      events: [],
    }

    sessionsById.set(sessionId, session)
    tabToSession.set(payload.captureTabId, sessionId)
    schedulePersist()
    await injectDebuggerScriptIntoTab(payload.captureTabId)

    return {
      sessionId,
      startedAt,
    }
  }

  const injectDebuggerScriptForTab = async (tabId: number): Promise<void> => {
    await ensureLoaded()

    if (!tabToSession.has(tabId)) {
      return
    }

    await injectDebuggerScriptIntoTab(tabId)
  }

  const appendPageEvents = async (tabId: number, rawEvents: unknown[]) => {
    await ensureLoaded()

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return
    }

    const normalizedEvents: DebuggerEvent[] = []
    for (const rawEvent of rawEvents) {
      const normalizedEvent = normalizeDebuggerEvent(rawEvent)
      if (!normalizedEvent) {
        continue
      }

      normalizedEvents.push(normalizedEvent)
    }

    appendEventsToSession(tabId, normalizedEvents)
  }

  const getSessionSnapshot = async (
    sessionId: string
  ): Promise<DebuggerSessionSnapshot | null> => {
    await ensureLoaded()

    const session = sessionsById.get(sessionId)
    if (!session) {
      return null
    }

    return {
      sessionId: session.sessionId,
      captureTabId: session.captureTabId,
      captureType: session.captureType,
      startedAt: session.startedAt,
      recordingStartedAt: session.recordingStartedAt,
      events: session.events,
    }
  }

  const markSessionRecordingStarted = async (
    payload: MarkRecordingStartedPayload
  ) => {
    await ensureLoaded()

    const session = sessionsById.get(payload.sessionId)
    if (!session) {
      return
    }

    session.recordingStartedAt = Math.floor(payload.recordingStartedAt)
    schedulePersist()
  }

  const discardSession = async (sessionId: string) => {
    await ensureLoaded()

    removeSession(sessionId)
    schedulePersist()
  }

  const ensureDebuggerScriptForTab = async (
    tabId: number,
    url?: string
  ): Promise<void> => {
    await ensureLoaded()

    if (!(url && isInjectablePageUrl(url))) {
      return
    }

    if (!tabToSession.has(tabId)) {
      return
    }

    await injectDebuggerScriptIntoTab(tabId)
  }

  const discardSessionByTabId = async (tabId: number): Promise<void> => {
    await ensureLoaded()

    const sessionId = tabToSession.get(tabId)
    if (!sessionId) {
      return
    }

    removeSession(sessionId)
    schedulePersist()
  }

  return {
    injectDebuggerScriptForTab,
    startSession,
    appendPageEvents,
    getSessionSnapshot,
    markSessionRecordingStarted,
    discardSession,
    ensureDebuggerScriptForTab,
    discardSessionByTabId,
  }
}
