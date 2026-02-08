import { reportNonFatalError } from "@crikket/shared/lib/errors"
import {
  BACKGROUND_LISTENER_FLAG,
  DEBUGGER_SESSIONS_STORAGE_KEY,
  DISCARD_SESSION_MESSAGE,
  GET_SESSION_SNAPSHOT_MESSAGE,
  MARK_RECORDING_STARTED_MESSAGE,
  MAX_EVENT_COUNT,
  PAGE_EVENT_MESSAGE,
  START_SESSION_MESSAGE,
} from "./constants"
import { isDebuggerRuntimeMessage } from "./messaging"
import { normalizeDebuggerEvent, normalizeStoredSession } from "./normalize"
import { injectedDebuggerScript } from "./page-script"
import type {
  DebuggerRuntimeResponse,
  DebuggerSessionSnapshot,
  StoredDebuggerSession,
} from "./types"

export function registerDebuggerBackgroundListeners(): void {
  const scope = globalThis as typeof globalThis & {
    [BACKGROUND_LISTENER_FLAG]?: boolean
  }

  if (scope[BACKGROUND_LISTENER_FLAG]) {
    return
  }

  scope[BACKGROUND_LISTENER_FLAG] = true

  const sessionsById = new Map<string, StoredDebuggerSession>()
  const tabToSession = new Map<number, string>()

  let isLoaded = false
  let loadPromise: Promise<void> | null = null
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  const schedulePersist = () => {
    if (persistTimer) return

    persistTimer = setTimeout(() => {
      persistTimer = null
      persistSessions().catch((error: unknown) => {
        reportNonFatalError("Failed to persist debugger sessions", error)
      })
    }, 250)
  }

  const persistSessions = async () => {
    const snapshot = Array.from(sessionsById.values())
    await chrome.storage.local.set({
      [DEBUGGER_SESSIONS_STORAGE_KEY]: snapshot,
    })
  }

  const ensureLoaded = async () => {
    if (isLoaded) return
    if (loadPromise) {
      await loadPromise
      return
    }

    loadPromise = (async () => {
      const result = await chrome.storage.local.get([
        DEBUGGER_SESSIONS_STORAGE_KEY,
      ])
      const storedSessions = result[DEBUGGER_SESSIONS_STORAGE_KEY]

      if (Array.isArray(storedSessions)) {
        for (const candidate of storedSessions) {
          const session = normalizeStoredSession(candidate)
          if (!session) continue

          sessionsById.set(session.sessionId, session)
          tabToSession.set(session.captureTabId, session.sessionId)
        }
      }

      isLoaded = true
      loadPromise = null
    })()

    await loadPromise
  }

  const removeSession = (sessionId: string) => {
    const session = sessionsById.get(sessionId)
    if (!session) return

    sessionsById.delete(sessionId)

    const activeSessionId = tabToSession.get(session.captureTabId)
    if (activeSessionId === sessionId) {
      tabToSession.delete(session.captureTabId)
    }
  }

  const startSession = async (payload: {
    captureTabId: number
    captureType: "video" | "screenshot"
  }) => {
    await ensureLoaded()

    const existingSessionId = tabToSession.get(payload.captureTabId)
    if (existingSessionId) {
      removeSession(existingSessionId)
    }

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

    return { sessionId, startedAt }
  }

  const appendPageEvent = async (
    sender: chrome.runtime.MessageSender,
    rawEvent: unknown
  ) => {
    await ensureLoaded()

    const tabId = sender.tab?.id
    if (typeof tabId !== "number") return

    const sessionId = tabToSession.get(tabId)
    if (!sessionId) return

    const session = sessionsById.get(sessionId)
    if (!session) return

    const event = normalizeDebuggerEvent(rawEvent)
    if (!event) return

    session.events.push(event)

    if (session.events.length > MAX_EVENT_COUNT) {
      session.events.splice(0, session.events.length - MAX_EVENT_COUNT)
    }

    schedulePersist()
  }

  const getSessionSnapshot = async (
    sessionId: string
  ): Promise<DebuggerSessionSnapshot | null> => {
    await ensureLoaded()

    const session = sessionsById.get(sessionId)
    if (!session) return null

    return {
      sessionId: session.sessionId,
      captureTabId: session.captureTabId,
      captureType: session.captureType,
      startedAt: session.startedAt,
      recordingStartedAt: session.recordingStartedAt,
      events: session.events,
    }
  }

  const markSessionRecordingStarted = async (payload: {
    sessionId: string
    recordingStartedAt: number
  }) => {
    await ensureLoaded()

    const session = sessionsById.get(payload.sessionId)
    if (!session) return

    session.recordingStartedAt = Math.floor(payload.recordingStartedAt)
    schedulePersist()
  }

  const discardSession = async (sessionId: string) => {
    await ensureLoaded()
    removeSession(sessionId)
    schedulePersist()
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isDebuggerRuntimeMessage(message)) {
      return
    }

    const safeSendResponse = <TData>(
      response: DebuggerRuntimeResponse<TData>
    ) => {
      sendResponse(response)
    }

    const onError = (error: unknown) => {
      safeSendResponse({
        ok: false,
        error:
          error instanceof Error ? error.message : "Debugger handler failed",
      })
    }

    const handler = async () => {
      if (message.type === START_SESSION_MESSAGE) {
        const data = await startSession(message.payload)
        safeSendResponse({ ok: true, data })
        return
      }

      if (message.type === MARK_RECORDING_STARTED_MESSAGE) {
        await markSessionRecordingStarted(message.payload)
        safeSendResponse({ ok: true, data: undefined })
        return
      }

      if (message.type === PAGE_EVENT_MESSAGE) {
        await appendPageEvent(sender, message.payload.event)
        safeSendResponse({ ok: true, data: undefined })
        return
      }

      if (message.type === GET_SESSION_SNAPSHOT_MESSAGE) {
        const data = await getSessionSnapshot(message.payload.sessionId)
        safeSendResponse({ ok: true, data })
        return
      }

      if (message.type === DISCARD_SESSION_MESSAGE) {
        await discardSession(message.payload.sessionId)
        safeSendResponse({ ok: true, data: undefined })
      }
    }

    handler().catch(onError)
    return true
  })
}

function createSessionId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }

  const random = Math.random().toString(36).slice(2, 10)
  return `dbg_${Date.now()}_${random}`
}

async function injectDebuggerScriptIntoTab(tabId: number): Promise<void> {
  if (!chrome.scripting?.executeScript) {
    return
  }

  try {
    await chrome.scripting.executeScript({
      target: {
        tabId,
      },
      world: "MAIN",
      func: injectedDebuggerScript,
    })
  } catch (error) {
    reportNonFatalError(
      `Failed to inject debugger instrumentation script into tab ${tabId}`,
      error
    )
  }
}
