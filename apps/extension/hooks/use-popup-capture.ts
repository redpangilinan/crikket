import { useState } from "react"
import {
  CAPTURE_CONTEXT_STORAGE_KEY,
  CAPTURE_TAB_ID_STORAGE_KEY,
  getActiveTabContext,
  RECORDER_TAB_ID_STORAGE_KEY,
  RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
  RECORDING_IN_PROGRESS_STORAGE_KEY,
  RECORDING_STARTED_AT_STORAGE_KEY,
} from "@/lib/capture-context"

export type PopupCaptureType = "video" | "screenshot"
const RECORDING_COUNTDOWN_SECONDS = 3

interface UsePopupCaptureReturn {
  isCapturing: boolean
  captureError: string | null
  pendingCaptureType: PopupCaptureType | null
  recordingCountdown: number | null
  requestCapture: (captureType: PopupCaptureType) => void
  clearPendingCapture: () => void
  startCapture: (captureType: PopupCaptureType) => Promise<void>
}

export function usePopupCapture(): UsePopupCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [recordingCountdown, setRecordingCountdown] = useState<number | null>(
    null
  )
  const [pendingCaptureType, setPendingCaptureType] =
    useState<PopupCaptureType | null>(null)

  const requestCapture = (captureType: PopupCaptureType) => {
    setCaptureError(null)
    setPendingCaptureType(captureType)
  }

  const clearPendingCapture = () => {
    setPendingCaptureType(null)
  }

  const startCapture = async (captureType: PopupCaptureType) => {
    setIsCapturing(true)
    setCaptureError(null)

    try {
      const captureContext = await getActiveTabContext()
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      const activeTab = tabs[0]
      if (!activeTab) {
        throw new Error("Could not find an active browser tab to capture.")
      }

      if (captureType === "screenshot") {
        if (typeof activeTab.windowId !== "number") {
          throw new Error("Could not find an active browser tab to capture.")
        }

        const base64data = await chrome.tabs.captureVisibleTab(
          activeTab.windowId,
          { format: "png" }
        )

        chrome.storage.local.set(
          {
            [CAPTURE_CONTEXT_STORAGE_KEY]: captureContext,
            pendingScreenshot: base64data,
          },
          () => {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                "/recorder.html?captureType=screenshot"
              ),
            })
            window.close()
          }
        )
        return
      }

      if (typeof activeTab.id !== "number") {
        throw new Error("Could not find an active browser tab to capture.")
      }

      const countdownEndsAt = Date.now() + RECORDING_COUNTDOWN_SECONDS * 1000
      chrome.storage.local.set({
        [RECORDING_IN_PROGRESS_STORAGE_KEY]: true,
        [RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY]: countdownEndsAt,
      })

      for (let seconds = RECORDING_COUNTDOWN_SECONDS; seconds > 0; seconds--) {
        setRecordingCountdown(seconds)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      setRecordingCountdown(null)
      chrome.storage.local.remove([RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY])

      chrome.storage.local.set(
        {
          [CAPTURE_CONTEXT_STORAGE_KEY]: captureContext,
          [CAPTURE_TAB_ID_STORAGE_KEY]: activeTab.id,
          startRecordingImmediately: true,
        },
        () => {
          chrome.tabs.create(
            {
              active: false,
              url: chrome.runtime.getURL("/recorder.html?captureType=video"),
            },
            (tab) => {
              if (typeof tab?.id === "number") {
                chrome.storage.local.set({
                  [RECORDER_TAB_ID_STORAGE_KEY]: tab.id,
                })
              }
            }
          )
          window.close()
        }
      )
    } catch (err) {
      console.error(err)
      setCaptureError(err instanceof Error ? err.message : "Failed to capture")
      setRecordingCountdown(null)
      chrome.storage.local.set({
        [RECORDING_IN_PROGRESS_STORAGE_KEY]: false,
      })
      chrome.storage.local.remove([
        RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        RECORDER_TAB_ID_STORAGE_KEY,
        RECORDING_STARTED_AT_STORAGE_KEY,
      ])
      setIsCapturing(false)
    } finally {
      setPendingCaptureType(null)
    }
  }

  return {
    isCapturing,
    captureError,
    pendingCaptureType,
    recordingCountdown,
    requestCapture,
    clearPendingCapture,
    startCapture,
  }
}
