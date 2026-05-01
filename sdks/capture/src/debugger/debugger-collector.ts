import { PAGE_BRIDGE_SOURCE } from "@crikket/capture-core/debugger/constants"
import {
  clearPersistedSession,
  loadPersistedSession,
  persistSession,
} from "./session-storage"
import {
  appendActionEventWithDedup,
  appendEventWithRetentionPolicy,
  appendNetworkEventWithDedup,
} from "@crikket/capture-core/debugger/engine/background/retention"
import { installDebuggerPageRuntime } from "@crikket/capture-core/debugger/engine/page"
import { normalizeDebuggerEvent } from "@crikket/capture-core/debugger/normalize"
import {
  buildDebuggerSubmissionPayload,
  hasDebuggerPayloadData,
} from "@crikket/capture-core/debugger/payload"
import type { DebuggerEvent } from "@crikket/capture-core/debugger/types"
import { MAX_RECENT_EVENT_AGE_MS, MAX_RECENT_EVENT_COUNT } from "../constants"
import type { CaptureType, DebuggerSession, ReviewSnapshot } from "../types"
import { createSessionId, isBridgePayload } from "../utils"

export class DebuggerCollector {
  private installed = false
  private recentEvents: DebuggerEvent[] = []
  private session: DebuggerSession | null = null

  private readonly handlePageHide = (): void => {
    if (this.session) {
      persistSession(this.session)
    }
  }

  private readonly handleWindowMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window) {
      return
    }

    const payload = event.data
    if (!isBridgePayload(payload) || payload.source !== PAGE_BRIDGE_SOURCE) {
      return
    }

    const incomingEvents = Array.isArray(payload.events)
      ? payload.events
      : [payload.event]

    const normalizedEvents: DebuggerEvent[] = []
    for (const candidate of incomingEvents) {
      const normalized = normalizeDebuggerEvent(candidate)
      if (normalized) {
        normalizedEvents.push(normalized)
      }
    }

    if (normalizedEvents.length === 0) {
      return
    }

    for (const normalizedEvent of normalizedEvents) {
      this.appendEvent(this.recentEvents, normalizedEvent)
      if (this.session) {
        this.appendEvent(this.session.events, normalizedEvent)
      }
    }

    this.trimRecentEvents()
  }

  install(): void {
    if (this.installed || typeof window === "undefined") {
      return
    }

    installDebuggerPageRuntime()
    window.addEventListener("message", this.handleWindowMessage)

    const restored = loadPersistedSession()
    if (restored) {
      this.session = {
        sessionId: restored.sessionId,
        captureType: restored.captureType,
        startedAt: restored.startedAt,
        recordingStartedAt: restored.recordingStartedAt,
        events: [...restored.events],
      }
    }

    window.addEventListener("pagehide", this.handlePageHide, { capture: true })
    this.installed = true
  }

  dispose(): void {
    if (!this.installed || typeof window === "undefined") {
      return
    }

    window.removeEventListener("message", this.handleWindowMessage)
    window.removeEventListener("pagehide", this.handlePageHide, { capture: true })
    this.installed = false
  }

  startSession(captureType: CaptureType, lookbackMs = 0): DebuggerSession {
    const now = Date.now()

    // If a session was restored from a previous page, carry its events forward
    // so the cross-page trace is preserved in the new recording segment.
    const priorSession = this.session
    const inheritedEvents: DebuggerEvent[] = priorSession
      ? [...priorSession.events]
      : []
    const sessionStartedAt = priorSession?.startedAt ?? now

    const nextSession: DebuggerSession = {
      sessionId: createSessionId(),
      captureType,
      startedAt: sessionStartedAt,
      recordingStartedAt: captureType === "screenshot" ? now : null,
      events: inheritedEvents,
    }

    if (lookbackMs > 0) {
      for (const event of this.recentEvents) {
        if (now - event.timestamp <= lookbackMs) {
          this.appendEvent(nextSession.events, event)
        }
      }
    }

    this.session = nextSession
    return nextSession
  }

  markRecordingStarted(recordingStartedAt: number): void {
    if (!this.session) {
      return
    }

    this.session.recordingStartedAt = Math.floor(recordingStartedAt)
  }

  clearSession(): void {
    this.session = null
    clearPersistedSession()
  }

  hasActiveSession(): boolean {
    return this.session !== null
  }

  getSessionStartedAt(): number | null {
    return this.session?.startedAt ?? null
  }

  finalizeSession(): ReviewSnapshot {
    if (!this.session) {
      return {
        warnings: [
          "Debugger session was not available. This report will not include debugger data.",
        ],
        debuggerSummary: {
          actions: 0,
          logs: 0,
          networkRequests: 0,
        },
      }
    }

    const payload = buildDebuggerSubmissionPayload({
      sessionId: this.session.sessionId,
      captureTabId: 0,
      captureType: this.session.captureType,
      startedAt: this.session.startedAt,
      recordingStartedAt: this.session.recordingStartedAt,
      events: this.session.events,
    })

    this.clearSession()

    const debuggerSummary = {
      actions: payload.actions.length,
      logs: payload.logs.length,
      networkRequests: payload.networkRequests.length,
    }

    const warnings: string[] = []
    const hasPayload = hasDebuggerPayloadData(payload)
    if (!hasPayload) {
      warnings.push(
        "No debugger events were captured. Reproduce the issue before submitting if you need event or network traces."
      )
    } else if (debuggerSummary.networkRequests === 0) {
      warnings.push(
        "No network requests were captured. API-level debugging context may be incomplete."
      )
    }

    return {
      warnings,
      debuggerSummary,
      debuggerPayload: hasPayload ? payload : undefined,
    }
  }

  private trimRecentEvents(): void {
    const now = Date.now()
    this.recentEvents = this.recentEvents.filter((event) => {
      return now - event.timestamp <= MAX_RECENT_EVENT_AGE_MS
    })

    if (this.recentEvents.length > MAX_RECENT_EVENT_COUNT) {
      this.recentEvents = this.recentEvents.slice(-MAX_RECENT_EVENT_COUNT)
    }
  }

  private appendEvent(events: DebuggerEvent[], event: DebuggerEvent): void {
    if (event.kind === "network") {
      appendNetworkEventWithDedup(events, event)
      return
    }

    if (event.kind === "action") {
      appendActionEventWithDedup(events, event)
      return
    }

    appendEventWithRetentionPolicy(events, event)
  }
}
