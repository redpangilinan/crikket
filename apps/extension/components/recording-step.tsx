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
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="relative">
        <div className="flex h-32 w-32 animate-pulse items-center justify-center rounded-full border-4 border-red-500 bg-red-500/10">
          <div className="h-16 w-16 rounded-full bg-red-500" />
        </div>
      </div>

      <div className="text-center">
        <p className="mb-2 font-medium text-slate-300 text-sm uppercase tracking-wider">
          Recording in Progress
        </p>
        <p className="font-mono text-5xl text-white">
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

      <p className="max-w-md text-center text-slate-400 text-sm">
        Click "Stop Recording" when you're done capturing the issue. You'll be
        able to add details and submit your bug report next.
      </p>
    </div>
  )
}
