import { BUG_REPORT_VISIBILITY_OPTIONS } from "@crikket/shared/constants/bug-report"
import { PRIORITY_OPTIONS } from "@crikket/shared/constants/priorities"
import type {
  CaptureDebuggerSummary,
  CapturedMedia,
  CapturePriority,
} from "../../types"
import type { CaptureUiState, CaptureUiStore } from "../types"

const DEFAULT_PRIORITY: CapturePriority = PRIORITY_OPTIONS.none
const DEFAULT_SUMMARY: CaptureDebuggerSummary = {
  actions: 0,
  logs: 0,
  networkRequests: 0,
}

export function createCaptureUiStore(): CaptureUiStore {
  let state = createInitialState()
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  const patchState = (patch: Partial<CaptureUiState>) => {
    state = {
      ...state,
      ...patch,
    }
    notify()
  }

  const showReview = (input: {
    media: CapturedMedia
    warnings: string[]
    summary: CaptureDebuggerSummary
  }) => {
    patchState({
      overlayOpen: true,
      recordingDockOpen: false,
      recordingStartedAt: null,
      view: "review",
      errorMessage: null,
      busy: false,
      media: input.media,
      warnings: [...input.warnings],
      summary: input.summary,
      shareUrl: "",
      copyLabel: "Copy Link",
      reviewDraft: {
        title: "",
        description: "",
        priority: DEFAULT_PRIORITY,
        visibility: BUG_REPORT_VISIBILITY_OPTIONS.private,
      },
      reviewFormKey: input.media.objectUrl,
    })
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    patchState,
    openChooser: () => {
      patchState({
        overlayOpen: true,
        recordingDockOpen: false,
        recordingStartedAt: null,
        view: "chooser",
        errorMessage: null,
        busy: false,
      })
    },
    close: () => {
      patchState({
        overlayOpen: false,
        recordingDockOpen: false,
        recordingStartedAt: null,
        busy: false,
        errorMessage: null,
      })
    },
    showRecording: (startedAt) => {
      patchState({
        overlayOpen: false,
        recordingDockOpen: true,
        recordingStartedAt: startedAt,
        view: "recording",
        errorMessage: null,
        busy: false,
      })
    },
    showReview,
    showSuccess: (shareUrl) => {
      patchState({
        overlayOpen: true,
        recordingDockOpen: false,
        recordingStartedAt: null,
        view: "success",
        errorMessage: null,
        busy: false,
        shareUrl: shareUrl ?? "",
        copyLabel: "Copy Link",
      })
    },
    showError: (message) => {
      patchState({
        errorMessage: message,
      })
    },
    setTitleIfEmpty: (value) => {
      if (state.reviewDraft.title.trim().length > 0) {
        return
      }

      patchState({
        reviewDraft: {
          ...state.reviewDraft,
          title: value.slice(0, 200),
        },
      })
    },
    destroy: () => {
      state = createInitialState()
      listeners.clear()
    },
  }
}

function createInitialState(): CaptureUiState {
  return {
    view: "chooser",
    overlayOpen: false,
    recordingDockOpen: false,
    busy: false,
    errorMessage: null,
    recordingStartedAt: null,
    warnings: [],
    summary: { ...DEFAULT_SUMMARY },
    media: null,
    shareUrl: "",
    copyLabel: "Copy Link",
    reviewDraft: {
      title: "",
      description: "",
      priority: DEFAULT_PRIORITY,
      visibility: BUG_REPORT_VISIBILITY_OPTIONS.private,
    },
    reviewFormKey: "",
  }
}
