import { reportNonFatalError } from "@crikket/shared/lib/errors"
import {
  BACKGROUND_LISTENER_FLAG,
  DEBUGGER_REPLAY_BUFFERS_STORAGE_KEY,
  DEBUGGER_SESSIONS_STORAGE_KEY,
  DISCARD_SESSION_MESSAGE,
  GET_SESSION_SNAPSHOT_MESSAGE,
  MARK_RECORDING_STARTED_MESSAGE,
  MAX_EVENT_COUNT,
  PAGE_EVENT_MESSAGE,
  START_SESSION_MESSAGE,
} from "./constants"
import { isDebuggerRuntimeMessage } from "./messaging"
import {
  normalizeDebuggerEvent,
  normalizeStoredReplayBuffer,
  normalizeStoredSession,
} from "./normalize"
import { injectedDebuggerScript } from "./page-script"
import type {
  DebuggerEvent,
  DebuggerRuntimeResponse,
  DebuggerSessionSnapshot,
  StoredDebuggerSession,
} from "./types"

const MAX_ACTION_EVENT_COUNT = 400
const MAX_CONSOLE_EVENT_COUNT = 800
const MAX_NETWORK_EVENT_COUNT = 1200
const ROLLING_REPLAY_WINDOW_MS = 2 * 60 * 1000
const MAX_ROLLING_REPLAY_EVENTS_PER_TAB = 1500
const DEFAULT_INSTANT_REPLAY_LOOKBACK_MS = 120 * 1000

interface PendingNetworkRequest {
  tabId: number
  method: string
  url: string
  startedAt: number
  requestHeaders?: Record<string, string>
}

interface TabReplayBuffer {
  events: DebuggerEvent[]
  lastTouchedAt: number
}

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
  const pendingNetworkRequests = new Map<string, PendingNetworkRequest>()
  const replayBuffersByTab = new Map<number, TabReplayBuffer>()

  let isLoaded = false
  let loadPromise: Promise<void> | null = null
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  const schedulePersist = () => {
    if (persistTimer) return

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
        if (!session) continue

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
    if (isLoaded) return
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
    if (!session) return

    sessionsById.delete(sessionId)

    const activeSessionId = tabToSession.get(session.captureTabId)
    if (activeSessionId === sessionId) {
      tabToSession.delete(session.captureTabId)
    }

    for (const [requestId, request] of pendingNetworkRequests) {
      if (request.tabId === session.captureTabId) {
        pendingNetworkRequests.delete(requestId)
      }
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

  const appendEventToTabTargets = (
    tabId: number,
    event: DebuggerEvent
  ): void => {
    const now = Date.now()
    const replayBuffer = getOrCreateReplayBuffer(tabId)
    if (event.kind === "network") {
      appendNetworkEventWithDedup(replayBuffer.events, event)
    } else {
      appendEventWithRetentionPolicy(replayBuffer.events, event)
    }
    pruneReplayBuffer(replayBuffer, now)
    pruneAllReplayBuffers(now)
    schedulePersist()

    const sessionId = tabToSession.get(tabId)
    if (!sessionId) {
      return
    }

    const session = sessionsById.get(sessionId)
    if (!session) {
      return
    }

    if (event.kind === "network") {
      appendNetworkEventWithDedup(session.events, event)
    } else {
      appendEventWithRetentionPolicy(session.events, event)
    }
  }

  const startSession = async (payload: {
    captureTabId: number
    captureType: "video" | "screenshot"
    instantReplayLookbackMs?: number
  }) => {
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

    return { sessionId, startedAt }
  }

  const appendPageEvent = async (
    sender: chrome.runtime.MessageSender,
    rawEvent: unknown
  ) => {
    await ensureLoaded()

    const tabId = sender.tab?.id
    if (typeof tabId !== "number") return

    const event = normalizeDebuggerEvent(rawEvent)
    if (!event) return

    appendEventToTabTargets(tabId, event)
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

  const discardSessionByTabId = async (tabId: number) => {
    await ensureLoaded()

    const sessionId = tabToSession.get(tabId)
    if (sessionId) {
      removeSession(sessionId)
      schedulePersist()
    }

    replayBuffersByTab.delete(tabId)
    for (const [requestId, request] of pendingNetworkRequests) {
      if (request.tabId === tabId) {
        pendingNetworkRequests.delete(requestId)
      }
    }
  }

  const beginTrackingWebRequest = async (
    details: chrome.webRequest.OnBeforeRequestDetails
  ) => {
    await ensureLoaded()

    if (!isApiLikeRequestType(details.type)) {
      return
    }

    const tabId = details.tabId
    if (typeof tabId !== "number" || tabId < 0) {
      return
    }

    pendingNetworkRequests.set(details.requestId, {
      tabId,
      method: details.method,
      url: details.url,
      startedAt: Math.floor(details.timeStamp),
    })
  }

  const attachRequestHeaders = async (
    details: chrome.webRequest.OnBeforeSendHeadersDetails
  ) => {
    await ensureLoaded()

    if (!isApiLikeRequestType(details.type)) {
      return
    }

    const tabId = details.tabId
    if (typeof tabId !== "number" || tabId < 0) {
      return
    }

    const tracked = pendingNetworkRequests.get(details.requestId)
    const normalizedHeaders = toHeaderRecord(details.requestHeaders)
    if (!tracked) {
      pendingNetworkRequests.set(details.requestId, {
        tabId,
        method: details.method,
        url: details.url,
        startedAt: Math.floor(details.timeStamp),
        requestHeaders: normalizedHeaders,
      })
      return
    }

    tracked.requestHeaders = normalizedHeaders
  }

  const completeTrackedWebRequest = async (
    details:
      | chrome.webRequest.OnCompletedDetails
      | chrome.webRequest.OnErrorOccurredDetails
  ) => {
    await ensureLoaded()

    if (!isApiLikeRequestType(details.type)) {
      pendingNetworkRequests.delete(details.requestId)
      return
    }

    const tabId = details.tabId
    if (typeof tabId !== "number" || tabId < 0) {
      pendingNetworkRequests.delete(details.requestId)
      return
    }

    const tracked = pendingNetworkRequests.get(details.requestId)
    pendingNetworkRequests.delete(details.requestId)

    const method = tracked?.method ?? details.method
    const url = tracked?.url ?? details.url
    const startedAt = tracked?.startedAt ?? Math.floor(details.timeStamp)
    const duration = Math.max(0, Math.floor(details.timeStamp - startedAt))

    const responseStatus =
      "statusCode" in details ? (details.statusCode ?? 0) : 0

    const responseHeaders =
      "responseHeaders" in details
        ? toHeaderRecord(details.responseHeaders)
        : undefined

    const responseBody =
      "error" in details && typeof details.error === "string"
        ? details.error
        : undefined

    appendEventToTabTargets(tabId, {
      kind: "network",
      timestamp: Math.floor(details.timeStamp),
      method,
      url,
      status: responseStatus,
      duration,
      requestHeaders: tracked?.requestHeaders,
      responseHeaders,
      responseBody,
    })
  }

  if (chrome.webRequest?.onBeforeRequest) {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        beginTrackingWebRequest(details).catch((error: unknown) => {
          reportNonFatalError(
            "Failed to track webRequest start for debugger session",
            error
          )
        })
        return undefined
      },
      { urls: ["<all_urls>"] }
    )
  }

  if (chrome.webRequest?.onBeforeSendHeaders) {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        attachRequestHeaders(details).catch((error: unknown) => {
          reportNonFatalError(
            "Failed to capture webRequest headers for debugger session",
            error
          )
        })
        return undefined
      },
      { urls: ["<all_urls>"] },
      ["requestHeaders"]
    )
  }

  if (chrome.webRequest?.onCompleted) {
    chrome.webRequest.onCompleted.addListener(
      (details) => {
        completeTrackedWebRequest(details).catch((error: unknown) => {
          reportNonFatalError(
            "Failed to capture completed webRequest for debugger session",
            error
          )
        })
        return undefined
      },
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    )
  }

  if (chrome.webRequest?.onErrorOccurred) {
    chrome.webRequest.onErrorOccurred.addListener(
      (details) => {
        completeTrackedWebRequest(details).catch((error: unknown) => {
          reportNonFatalError(
            "Failed to capture errored webRequest for debugger session",
            error
          )
        })
        return undefined
      },
      { urls: ["<all_urls>"] }
    )
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

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const didTabNavigate =
      changeInfo.status === "loading" || typeof changeInfo.url === "string"

    if (!didTabNavigate) {
      return
    }

    const url =
      typeof changeInfo.url === "string"
        ? changeInfo.url
        : (tab.url ?? undefined)

    ensureDebuggerScriptForTab(tabId, url).catch((error: unknown) => {
      reportNonFatalError(
        `Failed to reinject debugger instrumentation after tab update for tab ${tabId}`,
        error
      )
    })
  })

  chrome.tabs.onRemoved.addListener((tabId) => {
    discardSessionByTabId(tabId).catch((error: unknown) => {
      reportNonFatalError(
        `Failed to discard debugger session for removed tab ${tabId}`,
        error
      )
    })
  })

  chrome.tabs
    .query({})
    .then((tabs) => {
      for (const tab of tabs) {
        if (typeof tab.id !== "number") {
          continue
        }

        ensureDebuggerScriptForTab(tab.id, tab.url ?? undefined).catch(
          (error: unknown) => {
            reportNonFatalError(
              `Failed to inject debugger instrumentation for existing tab ${tab.id}`,
              error
            )
          }
        )
      }
    })
    .catch((error: unknown) => {
      reportNonFatalError("Failed to list tabs for debugger injection", error)
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

function isInjectablePageUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://")
}

function appendEventWithRetentionPolicy(
  events: DebuggerEvent[],
  event: DebuggerEvent
): void {
  events.push(event)

  enforceKindCap(events, event.kind)

  while (events.length > MAX_EVENT_COUNT) {
    const dropIndex = findOldestEventIndexByPriority(events, [
      "console",
      "action",
      "network",
    ])

    events.splice(dropIndex, 1)
  }
}

function appendNetworkEventWithDedup(
  events: DebuggerEvent[],
  event: Extract<DebuggerEvent, { kind: "network" }>
): void {
  if (isLikelyDuplicateNetworkEvent(events, event)) {
    return
  }

  appendEventWithRetentionPolicy(events, event)
}

function isLikelyDuplicateNetworkEvent(
  events: DebuggerEvent[],
  candidate: Extract<DebuggerEvent, { kind: "network" }>
): boolean {
  const DUPLICATE_WINDOW_MS = 350

  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (!event || event.kind !== "network") {
      continue
    }

    const isSameKey =
      event.method === candidate.method &&
      event.url === candidate.url &&
      (event.status ?? 0) === (candidate.status ?? 0)

    if (!isSameKey) {
      continue
    }

    const delta = Math.abs(event.timestamp - candidate.timestamp)
    if (delta > DUPLICATE_WINDOW_MS) {
      return false
    }

    return true
  }

  return false
}

function toHeaderRecord(
  headers: chrome.webRequest.HttpHeader[] | undefined
): Record<string, string> | undefined {
  if (!Array.isArray(headers)) {
    return undefined
  }

  const result: Record<string, string> = {}

  for (const header of headers) {
    if (typeof header.name !== "string" || !header.name) {
      continue
    }

    const value =
      typeof header.value === "string"
        ? header.value
        : Array.isArray(header.binaryValue)
          ? String.fromCharCode(...header.binaryValue)
          : null

    if (!value) {
      continue
    }

    result[header.name.slice(0, 120)] = value.slice(0, 500)
  }

  return Object.keys(result).length > 0 ? result : undefined
}

function isApiLikeRequestType(type: string | undefined): boolean {
  if (typeof type !== "string") {
    return false
  }

  // Keep only script-initiated API traffic from the webRequest fallback.
  return type === "xmlhttprequest" || type === "fetch"
}

function enforceKindCap(
  events: DebuggerEvent[],
  kind: DebuggerEvent["kind"]
): void {
  const maxPerKind = getMaxPerKind(kind)
  let count = 0

  for (const event of events) {
    if (event.kind === kind) {
      count += 1
    }
  }

  const overflowCount = count - maxPerKind
  if (overflowCount <= 0) {
    return
  }

  let removed = 0
  for (
    let index = 0;
    index < events.length && removed < overflowCount;
    index++
  ) {
    if (events[index]?.kind !== kind) {
      continue
    }

    events.splice(index, 1)
    index -= 1
    removed += 1
  }
}

function getMaxPerKind(kind: DebuggerEvent["kind"]): number {
  if (kind === "action") {
    return MAX_ACTION_EVENT_COUNT
  }

  if (kind === "console") {
    return MAX_CONSOLE_EVENT_COUNT
  }

  return MAX_NETWORK_EVENT_COUNT
}

function findOldestEventIndexByPriority(
  events: DebuggerEvent[],
  priority: DebuggerEvent["kind"][]
): number {
  for (const kind of priority) {
    const index = events.findIndex((event) => event.kind === kind)
    if (index >= 0) {
      return index
    }
  }

  return 0
}
