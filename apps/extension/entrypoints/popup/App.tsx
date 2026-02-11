import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Button } from "@crikket/ui/components/ui/button"
import { Keyboard } from "lucide-react"
import { PopupCaptureActions } from "@/components/popup-capture-actions"
import { useCommandShortcuts } from "@/hooks/use-command-shortcuts"
import { useHotkeyTrigger } from "@/hooks/use-hotkey-trigger"
import { usePopupCapture } from "@/hooks/use-popup-capture"
import { usePopupRecordingStatus } from "@/hooks/use-popup-recording-status"
import {
  HOTKEY_START_SCREENSHOT_CAPTURE_STORAGE_KEY,
  HOTKEY_START_VIDEO_CAPTURE_STORAGE_KEY,
} from "@/lib/capture-context"

function App() {
  const shortcuts = useCommandShortcuts()
  const {
    captureError,
    clearPendingCapture,
    isCapturing,
    pendingCaptureType,
    recordingCountdown: localRecordingCountdown,
    requestCapture,
    startCapture,
  } = usePopupCapture()
  const {
    isRecordingInProgress,
    recordingCountdown: syncedRecordingCountdown,
    recordingDurationMs,
    isStoppingFromPopup,
    stopError,
    stopFromPopup,
  } = usePopupRecordingStatus()

  const recordingCountdown =
    localRecordingCountdown ?? syncedRecordingCountdown ?? null
  const error = stopError ?? captureError
  const isBusy = isCapturing || isStoppingFromPopup

  useHotkeyTrigger({
    storageKey: HOTKEY_START_VIDEO_CAPTURE_STORAGE_KEY,
    enabled: !isRecordingInProgress,
    errorMessage: "Failed to start capture from hotkey popup flow",
    onTrigger: async () => {
      await startCapture("video")
    },
  })
  useHotkeyTrigger({
    storageKey: HOTKEY_START_SCREENSHOT_CAPTURE_STORAGE_KEY,
    enabled: !isRecordingInProgress,
    errorMessage: "Failed to start screenshot capture from hotkey popup flow",
    onTrigger: async () => {
      await startCapture("screenshot")
    },
  })

  return (
    <div className="w-[380px] space-y-4 p-4">
      <div className="space-y-1">
        <h1 className="font-medium font-mono text-xl leading-tight">crikket</h1>
        <p className="text-muted-foreground text-sm">
          Capture and report bugs with screenshots or recordings
        </p>
      </div>
      <div className="space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        ) : null}

        <PopupCaptureActions
          isBusy={isBusy}
          isRecordingInProgress={isRecordingInProgress}
          onClearPendingCapture={clearPendingCapture}
          onRequestCapture={requestCapture}
          onStartCapture={startCapture}
          onStopFromPopup={stopFromPopup}
          pendingCaptureType={pendingCaptureType}
          recordingCountdown={recordingCountdown}
          recordingDurationMs={recordingDurationMs}
          startRecordingShortcut={shortcuts.startRecording}
          startScreenshotShortcut={shortcuts.startScreenshot}
          stopRecordingShortcut={shortcuts.stopRecording}
        />

        <div className="rounded-md border bg-muted p-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            We only capture your current browser tab. A new tab will open for
            you to review and submit your report.
          </p>
        </div>

        <Button
          className="justify-start text-muted-foreground"
          onClick={async () => {
            try {
              await chrome.tabs.create({ url: "chrome://extensions/shortcuts" })
              window.close()
            } catch (error: unknown) {
              reportNonFatalError(
                "Failed to open Chrome extension shortcuts settings",
                error
              )
            }
          }}
          size="sm"
          variant="ghost"
        >
          <Keyboard />
          Keyboard shortcuts
        </Button>
      </div>
    </div>
  )
}

export default App
