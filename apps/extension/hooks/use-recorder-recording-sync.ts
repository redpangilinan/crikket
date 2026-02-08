import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useEffect } from "react"
import type { CaptureType } from "@/hooks/use-recorder-init"
import {
  RECORDER_TAB_ID_STORAGE_KEY,
  RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
  RECORDING_IN_PROGRESS_STORAGE_KEY,
  RECORDING_STARTED_AT_STORAGE_KEY,
} from "@/lib/capture-context"

interface UseRecorderRecordingSyncProps {
  captureType: CaptureType
  state: "idle" | "recording" | "stopped" | "submitting" | "success"
  onStopFromPopup: () => Promise<void>
}

export function useRecorderRecordingSync({
  captureType,
  onStopFromPopup,
  state,
}: UseRecorderRecordingSyncProps) {
  useEffect(() => {
    const clearRecordingFlags = async () => {
      await chrome.storage.local.set({
        [RECORDING_IN_PROGRESS_STORAGE_KEY]: false,
      })
      await chrome.storage.local.remove([
        RECORDER_TAB_ID_STORAGE_KEY,
        RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        RECORDING_STARTED_AT_STORAGE_KEY,
      ])
    }

    const syncRecordingState = async () => {
      if (captureType !== "video") {
        await clearRecordingFlags()
        return
      }

      if (state === "idle") {
        const result = await chrome.storage.local.get([
          RECORDING_IN_PROGRESS_STORAGE_KEY,
          RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        ])
        const isRecordingInProgress = Boolean(
          result[RECORDING_IN_PROGRESS_STORAGE_KEY]
        )
        const hasActiveCountdown =
          typeof result[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY] === "number"

        if (isRecordingInProgress && !hasActiveCountdown) {
          await clearRecordingFlags()
        }
        return
      }

      if (state === "recording") {
        const currentTab = await chrome.tabs.getCurrent()
        await chrome.storage.local.set({
          [RECORDING_IN_PROGRESS_STORAGE_KEY]: true,
          [RECORDING_STARTED_AT_STORAGE_KEY]: Date.now(),
          [RECORDER_TAB_ID_STORAGE_KEY]: currentTab?.id,
        })
        await chrome.storage.local.remove([
          RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        ])
        return
      }

      await clearRecordingFlags()
    }

    syncRecordingState().catch((error: unknown) => {
      reportNonFatalError("Failed to sync recorder recording state", error)
    })
  }, [captureType, state])

  useEffect(() => {
    const handleMessage = (message: { type?: string }) => {
      if (message.type !== "STOP_RECORDING_FROM_POPUP") return
      if (state !== "recording") return
      onStopFromPopup().catch((error: unknown) => {
        reportNonFatalError(
          "Failed to stop recording from popup trigger",
          error
        )
      })
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [onStopFromPopup, state])

  useEffect(() => {
    return () => {
      chrome.storage.local.set({
        [RECORDING_IN_PROGRESS_STORAGE_KEY]: false,
      })
      chrome.storage.local.remove([
        RECORDER_TAB_ID_STORAGE_KEY,
        RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        RECORDING_STARTED_AT_STORAGE_KEY,
      ])
    }
  }, [])
}
