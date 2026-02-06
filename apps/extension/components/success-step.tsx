import { Button } from "@crikket/ui/components/ui/button"
import { Check } from "lucide-react"
import { useState } from "react"

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
  const [isCopied, setIsCopied] = useState(false)
  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20">
        <Check className="h-12 w-12 text-green-600" />
      </div>

      <div className="text-center">
        <h2 className="font-semibold text-2xl">Bug Report Submitted!</h2>
        <p className="mt-2 text-muted-foreground">
          Your bug report has been created successfully
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3">
        <Button className="w-full" onClick={onOpenRecording} size="lg">
          View Bug Report
        </Button>
        <Button
          className="w-full"
          onClick={() => {
            onCopyLink()
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
          }}
          size="lg"
          variant="outline"
        >
          {isCopied ? (
            <>
              <Check />
              Copied
            </>
          ) : (
            "Copy Link"
          )}
        </Button>
        <Button
          className="w-full text-muted-foreground"
          onClick={onClose}
          variant="ghost"
        >
          Close
        </Button>
      </div>
    </div>
  )
}
