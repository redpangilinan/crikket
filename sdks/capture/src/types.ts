import type * as eagerCapture from "./eager"

export type CaptureType = "video" | "screenshot"
export type CapturePriority = "none" | "low" | "medium" | "high" | "critical"
export type CaptureReportVisibility = "public" | "private"

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

export interface CaptureInitOptions {
  key: string
  host?: string
  autoMount?: boolean
  mountTarget?: HTMLElement
  submitPath?: string
  zIndex?: number
  submitTransport?: CaptureSubmitTransport
  /**
   * Install the network/console debugger at init() instead of on first
   * capture, so requests made before the user opens the widget are captured.
   * Defaults to true.
   */
  collectDebuggerEagerly?: boolean
}

export interface CaptureRuntimeConfig {
  key: string
  host: string
  submitPath: string
  zIndex: number
}

export interface CaptureDebuggerSummary {
  actions: number
  logs: number
  networkRequests: number
}

export interface CaptureSubmissionDraft {
  title: string
  description: string
  priority: CapturePriority
  visibility?: CaptureReportVisibility
}

export interface CaptureSubmitRequest {
  config: CaptureRuntimeConfig
  report: {
    captureType: CaptureType
    title: string
    description: string
    priority: CapturePriority
    visibility: CaptureReportVisibility
    pageUrl: string
    pageTitle: string
    durationMs: number | null
    deviceInfo?: {
      browser?: string
      os?: string
      viewport?: string
    }
    debuggerPayload?: BugReportDebuggerPayload
    debuggerSummary: CaptureDebuggerSummary
    media: Blob
  }
}

export interface CaptureSubmitResult {
  shareUrl?: string
  reportId?: string
  raw?: unknown
}

export type CaptureSubmitTransport = (
  request: CaptureSubmitRequest
) => Promise<CaptureSubmitResult>

export interface CapturedMedia {
  blob: Blob
  captureType: CaptureType
  durationMs: number | null
  objectUrl: string
}

export interface ReviewSnapshot {
  debuggerPayload?: BugReportDebuggerPayload
  warnings: string[]
  debuggerSummary: CaptureDebuggerSummary
}

export interface BridgePayload {
  source: string
  event?: unknown
  events?: unknown[]
}

export interface RecordingController {
  startedAt: number
  finished: Promise<{
    blob: Blob
    durationMs: number
  }>
  stop: () => Promise<{
    blob: Blob
    durationMs: number
  }>
  abort: () => void
}

export interface DebuggerSession {
  sessionId: string
  captureType: CaptureType
  startedAt: number
  recordingStartedAt: number | null
  events: DebuggerEvent[]
}

export interface CaptureRuntimeController {
  open: () => void
  close: () => void
  destroy: () => void
  mount: (target?: HTMLElement) => void
  unmount: () => void
  startRecording: () => Promise<{ startedAt: number }>
  stopRecording: () => Promise<Blob | null>
  takeScreenshot: () => Promise<Blob | null>
  submit: (draft: CaptureSubmissionDraft) => Promise<CaptureSubmitResult>
  reset: () => void
  isInitialized: () => boolean
  getConfig: () => CaptureRuntimeConfig | null
}

export type CaptureGlobalApi = typeof eagerCapture
