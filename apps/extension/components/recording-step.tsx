import { Button } from "@crikket/ui/components/ui/button"
import { formatDuration } from "../lib/utils"

interface RecordingStepProps {
  duration: number
  onStopRecording: () => void
}

export function RecordingStep({
  duration,
  onStopRecording,
}: RecordingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-12">
      <div className="w-full max-w-sm rounded-md border border-destructive/20 bg-destructive/5 p-4 text-center">
        <p className="font-medium text-destructive text-sm">Recording now</p>
        <p className="font-mono font-semibold text-5xl text-destructive">
          {formatDuration(duration)}
        </p>
      </div>

      <Button
        className="min-w-[200px] font-semibold text-lg"
        onClick={onStopRecording}
        size="lg"
        variant="destructive"
      >
        ⏹ Stop Recording
      </Button>

      <p className="max-w-md text-center text-muted-foreground text-sm">
        Click "Stop Recording" when you're done capturing the issue. You'll be
        able to add details and submit your bug report next.
      </p>
    </div>
  )
}
