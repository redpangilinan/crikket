import type {
  CaptureDebuggerSummary,
  CapturedMedia,
  CaptureSubmissionDraft,
} from "../types"

export interface CaptureReviewSubmitOptions {
  screenshotBlobOverride?: Blob
}

export interface CaptureUiState {
  view: "chooser" | "recording" | "review" | "success"
  overlayOpen: boolean
  recordingDockOpen: boolean
  busy: boolean
  errorMessage: string | null
  recordingStartedAt: number | null
  warnings: string[]
  summary: CaptureDebuggerSummary
  media: CapturedMedia | null
  shareUrl: string
  // GitHub issue URL surfaced by the host server when its GitHub integration
  // is configured. Empty string when absent — keeps the field non-optional so
  // selectors don't need null-guards.
  githubIssueUrl: string
  copyLabel: string
  reviewDraft: CaptureSubmissionDraft
  reviewFormKey: string
}

export interface CaptureUiHandlers {
  onLauncherClick: () => void
  onClose: () => void
  onStartVideo: () => void
  onTakeScreenshot: () => void
  onStopRecording: () => void
  onSubmit: (
    draft: CaptureSubmissionDraft,
    options?: CaptureReviewSubmitOptions
  ) => Promise<void>
  onCancel: () => void
  onRetry: () => void
  onCopyLink: () => void
  onOpenLink: () => void
}

export interface CaptureUiCallbacks {
  onClose: () => void
  onStartVideo: () => Promise<{ startedAt: number }>
  onTakeScreenshot: () => Promise<void>
  onStopRecording: () => Promise<void>
  onSubmit: (
    draft: CaptureSubmissionDraft,
    options?: CaptureReviewSubmitOptions
  ) => Promise<void>
  onReset: () => void
}

export interface CaptureUiStore {
  getSnapshot: () => CaptureUiState
  subscribe: (listener: () => void) => () => void
  patchState: (patch: Partial<CaptureUiState>) => void
  openChooser: () => void
  close: () => void
  showRecording: (startedAt: number) => void
  showReview: (input: {
    media: CapturedMedia
    warnings: string[]
    summary: CaptureDebuggerSummary
  }) => void
  showSuccess: (input: { shareUrl?: string; githubIssueUrl?: string }) => void
  showError: (message: string) => void
  setTitleIfEmpty: (value: string) => void
  destroy: () => void
}

export interface MountedCaptureUi {
  setHidden: (hidden: boolean) => void
  store: CaptureUiStore
  unmount: () => void
}
