import { Button } from "@crikket/ui/components/ui/button"
import { Camera, Video } from "lucide-react"
import { ShortcutKbd } from "@/components/shortcut-kbd"
import type { PopupCaptureType } from "@/hooks/use-popup-capture"
import { formatDuration } from "@/lib/utils"

interface PopupCaptureActionsProps {
  isBusy: boolean
  isRecordingInProgress: boolean
  recordingCountdown: number | null
  recordingDurationMs: number
  pendingCaptureType: PopupCaptureType | null
  startRecordingShortcut: string | null
  startScreenshotShortcut: string | null
  stopRecordingShortcut: string | null
  onRequestCapture: (captureType: PopupCaptureType) => void
  onStopFromPopup: () => Promise<void>
  onStartCapture: (captureType: PopupCaptureType) => Promise<void>
  onClearPendingCapture: () => void
}

export function PopupCaptureActions({
  isBusy,
  isRecordingInProgress,
  recordingCountdown,
  recordingDurationMs,
  pendingCaptureType,
  startRecordingShortcut,
  startScreenshotShortcut,
  stopRecordingShortcut,
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
          <div className="rounded-md border bg-destructive/5 p-3 text-center">
            <p className="font-medium text-destructive text-sm">
              Recording now
            </p>
            <p className="font-mono font-semibold text-destructive text-xl">
              {formatDuration(recordingDurationMs)}
            </p>
          </div>
          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onStopFromPopup()}
            size="lg"
            variant="destructive"
          >
            <Video className="h-5 w-5" />
            <span>Stop Recording</span>
            <ShortcutKbd
              className="bg-destructive-foreground/15 text-destructive-foreground"
              shortcut={stopRecordingShortcut}
            />
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
            <ShortcutKbd
              className="bg-primary-foreground/15 text-primary-foreground"
              shortcut={startRecordingShortcut}
            />
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
            <ShortcutKbd
              className="bg-muted text-foreground"
              shortcut={startScreenshotShortcut}
            />
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
