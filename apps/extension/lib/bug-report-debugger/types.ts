import type {
  DISCARD_SESSION_MESSAGE,
  ENSURE_PAGE_RUNTIME_MESSAGE,
  GET_SESSION_SNAPSHOT_MESSAGE,
  MARK_RECORDING_STARTED_MESSAGE,
  PAGE_BRIDGE_SOURCE,
  PAGE_EVENT_MESSAGE,
  PAGE_EVENTS_MESSAGE,
  START_SESSION_MESSAGE,
} from "./constants"

export type DebuggerCaptureType = "video" | "screenshot"

export type DebuggerActionType =
  | "click"
  | "input"
  | "change"
  | "submit"
  | "keydown"
  | "navigation"

export interface DebuggerActionEvent {
  kind: "action"
  timestamp: number
  actionType: DebuggerActionType | string
  target?: string
  metadata?: Record<string, unknown>
}

export interface DebuggerConsoleEvent {
  kind: "console"
  timestamp: number
  level: "log" | "info" | "warn" | "error" | "debug"
  message: string
  metadata?: Record<string, unknown>
}

export interface DebuggerNetworkEvent {
  kind: "network"
  timestamp: number
  method: string
  url: string
  status?: number
  duration?: number
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBody?: string
  responseBody?: string
}

export type DebuggerEvent =
  | DebuggerActionEvent
  | DebuggerConsoleEvent
  | DebuggerNetworkEvent

export interface DebuggerSessionSnapshot {
  sessionId: string
  captureTabId: number
  captureType: DebuggerCaptureType
  startedAt: number
  recordingStartedAt: number | null
  events: DebuggerEvent[]
}

export interface BugReportDebuggerPayload {
  actions: Array<{
    type: string
    target?: string
    timestamp: string
    offset: number | null
    metadata?: Record<string, unknown>
  }>
  logs: Array<{
    level: "log" | "info" | "warn" | "error" | "debug"
    message: string
    timestamp: string
    offset: number | null
    metadata?: Record<string, unknown>
  }>
  networkRequests: Array<{
    method: string
    url: string
    status?: number
    duration?: number
    requestHeaders?: Record<string, string>
    responseHeaders?: Record<string, string>
    requestBody?: string
    responseBody?: string
    timestamp: string
    offset: number | null
  }>
}

export interface DebuggerStartSessionResponse {
  sessionId: string
  startedAt: number
}

export interface DebuggerRuntimeSuccess<TData = undefined> {
  ok: true
  data: TData
}

export interface DebuggerRuntimeFailure {
  ok: false
  error: string
}

export type DebuggerRuntimeResponse<TData = undefined> =
  | DebuggerRuntimeSuccess<TData>
  | DebuggerRuntimeFailure

export interface DebuggerStartSessionMessage {
  type: typeof START_SESSION_MESSAGE
  payload: {
    captureTabId: number
    captureType: DebuggerCaptureType
    instantReplayLookbackMs?: number
  }
}

export interface DebuggerMarkRecordingStartedMessage {
  type: typeof MARK_RECORDING_STARTED_MESSAGE
  payload: {
    sessionId: string
    recordingStartedAt: number
  }
}

export interface DebuggerGetSessionSnapshotMessage {
  type: typeof GET_SESSION_SNAPSHOT_MESSAGE
  payload: {
    sessionId: string
  }
}

export interface DebuggerDiscardSessionMessage {
  type: typeof DISCARD_SESSION_MESSAGE
  payload: {
    sessionId: string
  }
}

export interface DebuggerPageEventMessage {
  type: typeof PAGE_EVENT_MESSAGE
  payload: {
    event: unknown
  }
}

export interface DebuggerPageEventsMessage {
  type: typeof PAGE_EVENTS_MESSAGE
  payload: {
    events: unknown[]
  }
}

export interface DebuggerEnsurePageRuntimeMessage {
  type: typeof ENSURE_PAGE_RUNTIME_MESSAGE
  payload?: Record<string, never>
}

export type DebuggerRuntimeMessage =
  | DebuggerStartSessionMessage
  | DebuggerMarkRecordingStartedMessage
  | DebuggerGetSessionSnapshotMessage
  | DebuggerDiscardSessionMessage
  | DebuggerPageEventMessage
  | DebuggerPageEventsMessage
  | DebuggerEnsurePageRuntimeMessage

export interface DebuggerContentBridgePayload {
  source: typeof PAGE_BRIDGE_SOURCE
  event?: unknown
  events?: unknown[]
}

export interface StoredDebuggerSession {
  sessionId: string
  captureTabId: number
  captureType: DebuggerCaptureType
  startedAt: number
  recordingStartedAt: number | null
  events: DebuggerEvent[]
}
