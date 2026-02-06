import { Button } from "@crikket/ui/components/ui/button"
import { Camera, Video } from "lucide-react"

interface IdleStepProps {
  captureType: "video" | "screenshot"
  onStartRecording: () => void
}

export function IdleStep({ captureType, onStartRecording }: IdleStepProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="rounded-full bg-muted p-4">
        {captureType === "video" ? (
          <Video className="h-8 w-8" />
        ) : (
          <Camera className="h-8 w-8" />
        )}
      </div>
      <p className="max-w-sm text-center text-muted-foreground">
        Click below to start capturing your {captureType}. You will be prompted
        to select the screen or window.
      </p>
      <Button onClick={onStartRecording} size="lg">
        Start {captureType === "video" ? "Recording" : "Capture"}
      </Button>
    </div>
  )
}
