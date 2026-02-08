import { PopupCaptureActions } from "@/components/popup-capture-actions"
import { usePopupCapture } from "@/hooks/use-popup-capture"
import { usePopupRecordingStatus } from "@/hooks/use-popup-recording-status"

function App() {
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
        />

        <div className="rounded-md border bg-muted p-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            We only capture your current browser tab. A new tab will open for
            you to review and submit your report.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
