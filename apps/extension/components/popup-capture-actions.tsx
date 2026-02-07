import { Button } from "@crikket/ui/components/ui/button"
import { Camera, Video } from "lucide-react"
import type { PopupCaptureType } from "@/hooks/use-popup-capture"

interface PopupCaptureActionsProps {
  isBusy: boolean
  isRecordingInProgress: boolean
  recordingCountdown: number | null
  pendingCaptureType: PopupCaptureType | null
  onRequestCapture: (captureType: PopupCaptureType) => void
  onStopFromPopup: () => Promise<void>
  onStartCapture: (captureType: PopupCaptureType) => Promise<void>
  onClearPendingCapture: () => void
}

export function PopupCaptureActions({
  isBusy,
  isRecordingInProgress,
  recordingCountdown,
  pendingCaptureType,
  onRequestCapture,
  onStopFromPopup,
  onStartCapture,
  onClearPendingCapture,
}: PopupCaptureActionsProps) {
  if (recordingCountdown) {
    return (
      <div className="rounded-md border bg-primary/5 p-3 text-center">
        <p className="font-medium text-sm">Recording starts in</p>
        <p className="font-bold text-2xl">{recordingCountdown}...</p>
      </div>
    )
  }

  return (
    <>
      {isRecordingInProgress ? (
        <div className="space-y-2">
          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onStopFromPopup()}
            size="lg"
            variant="destructive"
          >
            <Video className="h-5 w-5" />
            <span>Stop Recording</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onRequestCapture("video")}
            size="lg"
            variant="default"
          >
            <Video className="h-5 w-5" />
            <span>Record Screen</span>
          </Button>

          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onRequestCapture("screenshot")}
            size="lg"
            variant="outline"
          >
            <Camera className="h-5 w-5" />
            <span>Take Screenshot</span>
          </Button>
        </div>
      )}

      {pendingCaptureType ? (
        <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm">
            Allow Crikket to capture your current tab for{" "}
            {pendingCaptureType === "video" ? "recording" : "screenshot"}?
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={isBusy}
              onClick={() => onStartCapture(pendingCaptureType)}
              size="sm"
            >
              Continue
            </Button>
            <Button
              className="flex-1"
              disabled={isBusy}
              onClick={onClearPendingCapture}
              size="sm"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
