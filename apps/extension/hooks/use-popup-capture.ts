import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useState } from "react"
import {
  appendDebuggerSessionIdToUrl,
  discardDebuggerSession,
  startDebuggerSession,
} from "@/lib/bug-report-debugger"
import {
  CAPTURE_CONTEXT_STORAGE_KEY,
  CAPTURE_TAB_ID_STORAGE_KEY,
  type CaptureContext,
  getActiveTabContext,
  RECORDER_TAB_ID_STORAGE_KEY,
  RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
  RECORDING_IN_PROGRESS_STORAGE_KEY,
  RECORDING_STARTED_AT_STORAGE_KEY,
} from "@/lib/capture-context"

export type PopupCaptureType = "video" | "screenshot"

const RECORDING_COUNTDOWN_SECONDS = 3
const ACTIVE_TAB_ERROR_MESSAGE =
  "Could not find an active browser tab to capture."

interface UsePopupCaptureReturn {
  isCapturing: boolean
  captureError: string | null
  pendingCaptureType: PopupCaptureType | null
  recordingCountdown: number | null
  requestCapture: (captureType: PopupCaptureType) => void
  clearPendingCapture: () => void
  startCapture: (captureType: PopupCaptureType) => Promise<void>
}

interface ActiveCaptureTab {
  id: number
  windowId: number | null
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

    let debuggerSessionId: string | null = null

    try {
      const captureContext = await getActiveTabContext()
      const activeTab = await getActiveCaptureTab()

      debuggerSessionId = await initializeDebuggerSession(
        captureType,
        activeTab.id
      )

      if (captureType === "screenshot") {
        await startScreenshotCapture({
          activeTab,
          captureContext,
          debuggerSessionId,
        })
      } else {
        await startVideoCapture({
          activeTab,
          captureContext,
          debuggerSessionId,
          setRecordingCountdown,
        })
      }

      window.close()
    } catch (err) {
      console.error(err)
      await handleCaptureFailure({
        debuggerSessionId,
        error: err,
        setCaptureError,
        setIsCapturing,
        setRecordingCountdown,
      })
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

async function getActiveCaptureTab(): Promise<ActiveCaptureTab> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })

  const activeTab = tabs[0]
  if (!activeTab || typeof activeTab.id !== "number") {
    throw new Error(ACTIVE_TAB_ERROR_MESSAGE)
  }

  return {
    id: activeTab.id,
    windowId:
      typeof activeTab.windowId === "number" ? activeTab.windowId : null,
  }
}

async function initializeDebuggerSession(
  captureType: PopupCaptureType,
  captureTabId: number
): Promise<string> {
  const session = await startDebuggerSession({
    captureTabId,
    captureType,
  })

  return session.sessionId
}

async function startScreenshotCapture(input: {
  activeTab: ActiveCaptureTab
  captureContext: CaptureContext
  debuggerSessionId: string
}): Promise<void> {
  if (input.activeTab.windowId === null) {
    throw new Error(ACTIVE_TAB_ERROR_MESSAGE)
  }

  const base64data = await chrome.tabs.captureVisibleTab(
    input.activeTab.windowId,
    {
      format: "png",
    }
  )

  await chrome.storage.local.set({
    [CAPTURE_CONTEXT_STORAGE_KEY]: input.captureContext,
    pendingScreenshot: base64data,
  })

  const recorderUrl = appendDebuggerSessionIdToUrl(
    chrome.runtime.getURL("/recorder.html?captureType=screenshot"),
    input.debuggerSessionId
  )

  await chrome.tabs.create({
    url: recorderUrl,
  })
}

async function startVideoCapture(input: {
  activeTab: ActiveCaptureTab
  captureContext: CaptureContext
  debuggerSessionId: string
  setRecordingCountdown: (value: number | null) => void
}): Promise<void> {
  const countdownEndsAt = Date.now() + RECORDING_COUNTDOWN_SECONDS * 1000

  await chrome.storage.local.set({
    [RECORDING_IN_PROGRESS_STORAGE_KEY]: true,
    [RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY]: countdownEndsAt,
  })

  await runCountdown(input.setRecordingCountdown)

  await chrome.storage.local.remove([RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY])

  await chrome.storage.local.set({
    [CAPTURE_CONTEXT_STORAGE_KEY]: input.captureContext,
    [CAPTURE_TAB_ID_STORAGE_KEY]: input.activeTab.id,
    startRecordingImmediately: true,
  })

  const recorderUrl = appendDebuggerSessionIdToUrl(
    chrome.runtime.getURL("/recorder.html?captureType=video"),
    input.debuggerSessionId
  )

  const recorderTab = await chrome.tabs.create({
    active: false,
    url: recorderUrl,
  })

  if (typeof recorderTab.id === "number") {
    await chrome.storage.local.set({
      [RECORDER_TAB_ID_STORAGE_KEY]: recorderTab.id,
    })
  }
}

async function runCountdown(
  setRecordingCountdown: (value: number | null) => void
): Promise<void> {
  for (let seconds = RECORDING_COUNTDOWN_SECONDS; seconds > 0; seconds--) {
    setRecordingCountdown(seconds)
    await delay(1000)
  }

  setRecordingCountdown(null)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function handleCaptureFailure(input: {
  debuggerSessionId: string | null
  error: unknown
  setCaptureError: (value: string) => void
  setIsCapturing: (value: boolean) => void
  setRecordingCountdown: (value: number | null) => void
}): Promise<void> {
  if (input.debuggerSessionId) {
    await discardDebuggerSession(input.debuggerSessionId).catch(
      (error: unknown) => {
        reportNonFatalError(
          `Failed to discard debugger session ${input.debuggerSessionId} during capture failure cleanup`,
          error
        )
      }
    )
  }

  input.setCaptureError(
    input.error instanceof Error ? input.error.message : "Failed to capture"
  )
  input.setRecordingCountdown(null)

  await chrome.storage.local.set({
    [RECORDING_IN_PROGRESS_STORAGE_KEY]: false,
  })

  await chrome.storage.local.remove([
    RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
    RECORDER_TAB_ID_STORAGE_KEY,
    RECORDING_STARTED_AT_STORAGE_KEY,
  ])

  input.setIsCapturing(false)
}
