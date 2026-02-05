import { Button } from "@crikket/ui/components/ui/button"

interface InitialStepProps {
  onStartRecording: () => void
  onTakeScreenshot: () => void
}

export function InitialStep({
  onStartRecording,
  onTakeScreenshot,
}: InitialStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <Button className="w-full" onClick={onStartRecording} size="lg">
        🎥 Record Screen
      </Button>
      <Button
        className="w-full"
        onClick={onTakeScreenshot}
        size="lg"
        variant="secondary"
      >
        📸 Take Screenshot
      </Button>
    </div>
  )
}
