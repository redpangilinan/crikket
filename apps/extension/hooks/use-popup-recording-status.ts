import { useCallback, useEffect, useState } from "react"
import {
  RECORDER_TAB_ID_STORAGE_KEY,
  RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
  RECORDING_IN_PROGRESS_STORAGE_KEY,
} from "@/lib/capture-context"

interface UsePopupRecordingStatusReturn {
  isRecordingInProgress: boolean
  recordingCountdown: number | null
  isStoppingFromPopup: boolean
  stopError: string | null
  stopFromPopup: () => Promise<void>
}

export function usePopupRecordingStatus(): UsePopupRecordingStatusReturn {
  const [isRecordingInProgress, setIsRecordingInProgress] = useState(false)
  const [recordingCountdown, setRecordingCountdown] = useState<number | null>(
    null
  )
  const [recorderTabId, setRecorderTabId] = useState<number | null>(null)
  const [isStoppingFromPopup, setIsStoppingFromPopup] = useState(false)
  const [stopError, setStopError] = useState<string | null>(null)

  useEffect(() => {
    let intervalId: number | undefined

    const updateCountdown = (endsAt?: number) => {
      if (typeof endsAt !== "number") {
        setRecordingCountdown(null)
        if (intervalId !== undefined) {
          window.clearInterval(intervalId)
          intervalId = undefined
        }
        return
      }

      const update = () => {
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
        setRecordingCountdown(remaining > 0 ? remaining : null)
        if (remaining <= 0 && intervalId !== undefined) {
          window.clearInterval(intervalId)
          intervalId = undefined
        }
      }

      update()
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
      }
      intervalId = window.setInterval(update, 250)
    }

    const syncRecordingState = () => {
      chrome.storage.local.get(
        [
          RECORDING_IN_PROGRESS_STORAGE_KEY,
          RECORDER_TAB_ID_STORAGE_KEY,
          RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        ],
        (result) => {
          setIsRecordingInProgress(
            Boolean(result[RECORDING_IN_PROGRESS_STORAGE_KEY])
          )
          const tabId = result[RECORDER_TAB_ID_STORAGE_KEY]
          setRecorderTabId(typeof tabId === "number" ? tabId : null)
          updateCountdown(
            result[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY] as
              | number
              | undefined
          )
        }
      )
    }

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local") return
      if (
        !(
          changes[RECORDING_IN_PROGRESS_STORAGE_KEY] ||
          changes[RECORDER_TAB_ID_STORAGE_KEY] ||
          changes[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY]
        )
      ) {
        return
      }
      syncRecordingState()
    }

    syncRecordingState()
    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
      }
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const stopFromPopup = useCallback(async () => {
    setIsStoppingFromPopup(true)
    setStopError(null)

    try {
      await chrome.runtime.sendMessage({ type: "STOP_RECORDING_FROM_POPUP" })

      if (recorderTabId !== null) {
        const recorderTab = await chrome.tabs.get(recorderTabId)
        if (typeof recorderTab.windowId === "number") {
          await chrome.windows.update(recorderTab.windowId, { focused: true })
        }
        await chrome.tabs.update(recorderTabId, { active: true })
      }

      window.close()
    } catch (err) {
      console.error(err)
      setStopError(
        err instanceof Error ? err.message : "Failed to stop recording"
      )
      setIsStoppingFromPopup(false)
    }
  }, [recorderTabId])

  return {
    isRecordingInProgress,
    recordingCountdown,
    isStoppingFromPopup,
    stopError,
    stopFromPopup,
  }
}
