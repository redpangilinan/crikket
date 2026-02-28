import type {
  BugReportDebuggerPayload,
  DebuggerEvent,
} from "@crikket/capture-core/debugger/types"
import type { BugReportVisibility } from "@crikket/shared/constants/bug-report"
import type { Priority } from "@crikket/shared/constants/priorities"
import type * as eagerCapture from "./eager"

export type CaptureType = "video" | "screenshot"
export type CapturePriority = Priority
export type CaptureReportVisibility = BugReportVisibility

export interface CaptureInitOptions {
  key: string
  host?: string
  autoMount?: boolean
  mountTarget?: HTMLElement
  submitPath?: string
  zIndex?: number
  submitTransport?: CaptureSubmitTransport
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
    sdkVersion: string
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
