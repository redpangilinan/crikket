import { reportNonFatalError } from "@crikket/shared/lib/errors"
import {
  DEBUGGER_REPLAY_BUFFERS_STORAGE_KEY,
  DEBUGGER_SESSIONS_STORAGE_KEY,
} from "../../constants"
import {
  normalizeDebuggerEvent,
  normalizeStoredReplayBuffer,
  normalizeStoredSession,
} from "../../normalize"
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
  appendEventWithRetentionPolicy,
  appendNetworkEventWithDedup,
} from "./retention"

const ROLLING_REPLAY_WINDOW_MS = 2 * 60 * 1000
const MAX_ROLLING_REPLAY_EVENTS_PER_TAB = 1500
const DEFAULT_INSTANT_REPLAY_LOOKBACK_MS = 120 * 1000

interface TabReplayBuffer {
  events: DebuggerEvent[]
  lastTouchedAt: number
}

interface StartSessionPayload {
  captureTabId: number
  captureType: "video" | "screenshot"
  instantReplayLookbackMs?: number
}

interface MarkRecordingStartedPayload {
  sessionId: string
  recordingStartedAt: number
}

interface DebuggerSessionStore {
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
  const replayBuffersByTab = new Map<number, TabReplayBuffer>()

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
    const replayBuffersSnapshot = Array.from(replayBuffersByTab.entries()).map(
      ([tabId, replayBuffer]) => ({
        tabId,
        lastTouchedAt: replayBuffer.lastTouchedAt,
        events: replayBuffer.events,
      })
    )

    await chrome.storage.local.set({
      [DEBUGGER_SESSIONS_STORAGE_KEY]: sessionsSnapshot,
      [DEBUGGER_REPLAY_BUFFERS_STORAGE_KEY]: replayBuffersSnapshot,
    })
  }

  const pruneReplayBuffer = (
    replayBuffer: TabReplayBuffer,
    now: number
  ): void => {
    while (replayBuffer.events.length > 0) {
      const oldestEvent = replayBuffer.events[0]
      if (!oldestEvent) {
        break
      }

      if (now - oldestEvent.timestamp <= ROLLING_REPLAY_WINDOW_MS) {
        break
      }

      replayBuffer.events.shift()
    }

    while (replayBuffer.events.length > MAX_ROLLING_REPLAY_EVENTS_PER_TAB) {
      replayBuffer.events.shift()
    }

    replayBuffer.lastTouchedAt = now
  }

  const pruneAllReplayBuffers = (now: number): void => {
    for (const [tabId, replayBuffer] of replayBuffersByTab) {
      pruneReplayBuffer(replayBuffer, now)

      const isStale =
        now - replayBuffer.lastTouchedAt > ROLLING_REPLAY_WINDOW_MS
      if (replayBuffer.events.length === 0 && isStale) {
        replayBuffersByTab.delete(tabId)
      }
    }
  }

  const hydrateStoredState = async () => {
    const result = await chrome.storage.local.get([
      DEBUGGER_SESSIONS_STORAGE_KEY,
      DEBUGGER_REPLAY_BUFFERS_STORAGE_KEY,
    ])
    const storedSessions = result[DEBUGGER_SESSIONS_STORAGE_KEY]
    const storedReplayBuffers = result[DEBUGGER_REPLAY_BUFFERS_STORAGE_KEY]

    if (Array.isArray(storedSessions)) {
      for (const candidate of storedSessions) {
        const session = normalizeStoredSession(candidate)
        if (!session) {
          continue
        }

        sessionsById.set(session.sessionId, session)
        tabToSession.set(session.captureTabId, session.sessionId)
      }
    }

    if (Array.isArray(storedReplayBuffers)) {
      for (const candidate of storedReplayBuffers) {
        const replayBuffer = normalizeStoredReplayBuffer(candidate)
        if (!replayBuffer) {
          continue
        }

        replayBuffersByTab.set(replayBuffer.tabId, {
          events: replayBuffer.events,
          lastTouchedAt: replayBuffer.lastTouchedAt,
        })
      }
    }

    pruneAllReplayBuffers(Date.now())
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

  const getOrCreateReplayBuffer = (tabId: number): TabReplayBuffer => {
    const existing = replayBuffersByTab.get(tabId)
    if (existing) {
      return existing
    }

    const created: TabReplayBuffer = {
      events: [],
      lastTouchedAt: Date.now(),
    }
    replayBuffersByTab.set(tabId, created)
    return created
  }

  const normalizeInstantReplayLookbackMs = (
    value: number | undefined
  ): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return DEFAULT_INSTANT_REPLAY_LOOKBACK_MS
    }

    const normalized = Math.floor(value)
    return Math.max(0, Math.min(ROLLING_REPLAY_WINDOW_MS, normalized))
  }

  const getReplaySeedEvents = (
    tabId: number,
    lookbackMs: number,
    now: number
  ): DebuggerEvent[] => {
    if (lookbackMs <= 0) {
      return []
    }

    const replayBuffer = replayBuffersByTab.get(tabId)
    if (!replayBuffer) {
      return []
    }

    pruneReplayBuffer(replayBuffer, now)
    const lowerBound = now - lookbackMs

    return replayBuffer.events.filter((event) => event.timestamp >= lowerBound)
  }

  const appendEventsToTabTargets = (
    tabId: number,
    events: DebuggerEvent[]
  ): void => {
    if (events.length === 0) {
      return
    }

    const now = Date.now()
    const replayBuffer = getOrCreateReplayBuffer(tabId)
    const sessionId = tabToSession.get(tabId)
    const session = sessionId ? sessionsById.get(sessionId) : undefined

    for (const event of events) {
      if (event.kind === "network") {
        appendNetworkEventWithDedup(replayBuffer.events, event)
      } else {
        appendEventWithRetentionPolicy(replayBuffer.events, event)
      }

      if (!session) {
        continue
      }

      if (event.kind === "network") {
        appendNetworkEventWithDedup(session.events, event)
      } else {
        appendEventWithRetentionPolicy(session.events, event)
      }
    }

    pruneReplayBuffer(replayBuffer, now)
    pruneAllReplayBuffers(now)
    schedulePersist()
  }

  const startSession = async (payload: StartSessionPayload) => {
    await ensureLoaded()

    const existingSessionId = tabToSession.get(payload.captureTabId)
    if (existingSessionId) {
      removeSession(existingSessionId)
    }

    const startedAt = Date.now()
    const sessionId = createSessionId()
    const replayLookbackMs = normalizeInstantReplayLookbackMs(
      payload.instantReplayLookbackMs
    )
    const replaySeedEvents = getReplaySeedEvents(
      payload.captureTabId,
      replayLookbackMs,
      startedAt
    )

    const session: StoredDebuggerSession = {
      sessionId,
      captureTabId: payload.captureTabId,
      captureType: payload.captureType,
      startedAt,
      recordingStartedAt:
        payload.captureType === "screenshot" ? startedAt : null,
      events: replaySeedEvents,
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

    appendEventsToTabTargets(tabId, normalizedEvents)
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

    await injectDebuggerScriptIntoTab(tabId)
  }

  const discardSessionByTabId = async (tabId: number): Promise<void> => {
    await ensureLoaded()

    const sessionId = tabToSession.get(tabId)
    if (sessionId) {
      removeSession(sessionId)
      schedulePersist()
    }

    replayBuffersByTab.delete(tabId)
  }

  return {
    startSession,
    appendPageEvents,
    getSessionSnapshot,
    markSessionRecordingStarted,
    discardSession,
    ensureDebuggerScriptForTab,
    discardSessionByTabId,
  }
}
