import { useEffect, useState } from "react"

export type RecordingState =
  | "idle"
  | "recording"
  | "stopped"
  | "form"
  | "submitting"
  | "success"

export interface RecordingSession {
  state: RecordingState
  captureType: "video" | "screenshot"
  blob?: Blob
  previewUrl?: string
  error?: string
  startTime?: number
  recordedBlob?: Blob
  screenshotBlob?: Blob
}

export function useRecordingSession() {
  const [session, setSession] = useState<RecordingSession>({
    state: "idle",
    captureType: "video",
  })

  useEffect(() => {
    const handleMessage = (
      message: { type: string; session?: RecordingSession },
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: unknown) => void
    ) => {
      if (message.type === "RECORDING_SESSION_UPDATE") {
        setSession(message.session!)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    chrome.runtime.sendMessage(
      { type: "GET_RECORDING_SESSION" },
      (response) => {
        if (response?.session) {
          setSession(response.session)
        }
      }
    )

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const stopRecording = () => {
    chrome.runtime.sendMessage({ type: "STOP_RECORDING" })
  }

  const reset = () => {
    chrome.runtime.sendMessage({ type: "RESET_RECORDING" })
  }

  return {
    session,
    stopRecording,
    reset,
  }
}
