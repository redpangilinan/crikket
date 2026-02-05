import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"

interface SuccessStepProps {
  onOpenRecording: () => void
  onCopyLink: () => void
  onClose: () => void
}

export function SuccessStep({
  onOpenRecording,
  onCopyLink,
  onClose,
}: SuccessStepProps) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 text-center text-5xl">✅</div>
        <CardTitle className="text-center text-emerald-500">
          Bug Report Created!
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <Button className="w-full" onClick={onOpenRecording} size="lg">
          🔗 Open Recording
        </Button>
        <Button
          className="w-full"
          onClick={onCopyLink}
          size="lg"
          variant="secondary"
        >
          📋 Copy Link
        </Button>
        <Button className="w-full" onClick={onClose} variant="ghost">
          Close
        </Button>
      </CardContent>
    </Card>
  )
}
