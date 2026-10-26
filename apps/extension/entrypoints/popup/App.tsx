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
    microphoneEnabled,
    toggleMicrophone,
    fullScreenEnabled,
    toggleFullScreen,
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
          Captura y reporta errores con capturas de pantalla o grabaciones
        </p>
      </div>
      <div className="space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        ) : null}

        <PopupCaptureActions
          fullScreenEnabled={fullScreenEnabled}
          isBusy={isBusy}
          isRecordingInProgress={isRecordingInProgress}
          microphoneEnabled={microphoneEnabled}
          onClearPendingCapture={clearPendingCapture}
          onFullScreenToggle={toggleFullScreen}
          onMicrophoneToggle={toggleMicrophone}
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
            {fullScreenEnabled
              ? "Las grabaciones capturarán la pantalla que elijas; las capturas de pantalla siguen siendo de tu pestaña actual."
              : "Solo capturamos tu pestaña actual."}{" "}
            Se abrirá una nueva pestaña para que revises y envíes tu reporte.
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
          Atajos de teclado
        </Button>
      </div>
    </div>
  )
}

export default App
