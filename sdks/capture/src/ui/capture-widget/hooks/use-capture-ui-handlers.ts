import { useEffect, useRef, useState } from "react"
import { toUserError } from "../../../utils"
import type {
  CaptureUiCallbacks,
  CaptureUiHandlers,
  CaptureUiStore,
} from "../../types"

const COPY_RESET_DELAY_MS = 1500

interface UseCaptureUiHandlersInput {
  callbacks: CaptureUiCallbacks
  shareUrl: string
  store: CaptureUiStore
}

interface UseCaptureUiHandlersResult {
  handlers: CaptureUiHandlers
  isSubmitPending: boolean
}

export function useCaptureUiHandlers(
  input: UseCaptureUiHandlersInput
): UseCaptureUiHandlersResult {
  const copyResetTimeoutRef = useRef<number | null>(null)
  const [isSubmitPending, setIsSubmitPending] = useState(false)

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  const runBusyTask = async (task: () => Promise<void>): Promise<void> => {
    input.store.patchState({
      busy: true,
      errorMessage: null,
    })

    try {
      await task()
    } finally {
      input.store.patchState({
        busy: false,
      })
    }
  }

  const startBusyTask = (task: () => Promise<void>) => {
    runBusyTask(task).catch(() => undefined)
  }

  const showCaptureError = (error: unknown) => {
    input.store.openChooser()
    input.store.showError(toUserError(error))
  }

  return {
    isSubmitPending,
    handlers: {
      onLauncherClick: () => {
        input.callbacks.onReset()
        input.store.openChooser()
      },
      onClose: () => {
        input.callbacks.onClose()
      },
      onStartVideo: () => {
        startBusyTask(async () => {
          try {
            const result = await input.callbacks.onStartVideo()
            input.store.showRecording(result.startedAt)
          } catch (error) {
            showCaptureError(error)
          }
        })
      },
      onTakeScreenshot: () => {
        startBusyTask(async () => {
          try {
            await input.callbacks.onTakeScreenshot()
          } catch (error) {
            showCaptureError(error)
          }
        })
      },
      onStopRecording: () => {
        startBusyTask(async () => {
          try {
            await input.callbacks.onStopRecording()
          } catch (error) {
            showCaptureError(error)
          }
        })
      },
      onSubmit: (draft) => {
        setIsSubmitPending(true)
        input.store.patchState({
          errorMessage: null,
          reviewDraft: draft,
        })

        input.callbacks
          .onSubmit(draft)
          .catch((error) => {
            input.store.showError(toUserError(error))
          })
          .finally(() => {
            setIsSubmitPending(false)
          })
      },
      onCancel: () => {
        input.callbacks.onReset()
        input.store.openChooser()
      },
      onRetry: () => {
        input.callbacks.onReset()
        input.store.openChooser()
      },
      onCopyLink: () => {
        if (!input.shareUrl.trim()) {
          return
        }

        navigator.clipboard
          .writeText(input.shareUrl)
          .then(() => {
            input.store.patchState({
              copyLabel: "Copied",
            })

            if (copyResetTimeoutRef.current !== null) {
              window.clearTimeout(copyResetTimeoutRef.current)
            }

            copyResetTimeoutRef.current = window.setTimeout(() => {
              input.store.patchState({
                copyLabel: "Copy Link",
              })
            }, COPY_RESET_DELAY_MS)
          })
          .catch((error: unknown) => {
            input.store.showError(toUserError(error))
          })
      },
      onOpenLink: () => {
        if (!input.shareUrl.trim()) {
          return
        }

        window.open(input.shareUrl, "_blank", "noopener")
      },
    },
  }
}
