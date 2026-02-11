import { Button } from "@crikket/ui/components/ui/button"
import { ShortcutKbd } from "@/components/shortcut-kbd"
import { formatDuration } from "../lib/utils"

interface RecordingStepProps {
  duration: number
  onStopRecording: () => void
  stopRecordingShortcut: string | null
}

export function RecordingStep({
  duration,
  onStopRecording,
  stopRecordingShortcut,
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
        className="flex min-w-[200px] items-center gap-3 font-semibold text-lg"
        onClick={onStopRecording}
        size="lg"
        variant="destructive"
      >
        <span>⏹ Stop Recording</span>
        <ShortcutKbd
          className="bg-destructive-foreground/15 text-destructive-foreground"
          shortcut={stopRecordingShortcut}
        />
      </Button>

      <p className="max-w-md text-center text-muted-foreground text-sm">
        Click "Stop Recording" when you're done capturing the issue. You'll be
        able to add details and submit your bug report next.
      </p>
    </div>
  )
}
