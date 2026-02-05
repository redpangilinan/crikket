import { Button } from "@crikket/ui/components/ui/button"

interface RecordingStepProps {
  isRecording: boolean
  onStopRecording: () => void
}

export function RecordingStep({
  isRecording,
  onStopRecording,
}: RecordingStepProps) {
  if (!isRecording) return null

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-2.5 text-base text-destructive">
        <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
        Recording...
      </div>
      <Button
        className="w-full"
        onClick={onStopRecording}
        size="lg"
        variant="destructive"
      >
        ⏹ Stop Recording
      </Button>
    </div>
  )
}
