import { Button } from "@crikket/ui/components/ui/button"
import { Card, CardContent } from "@crikket/ui/components/ui/card"

interface ErrorDisplayProps {
  error: string | null
  onRetry: () => void
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  if (!error) return null

  return (
    <Card className="border-destructive/30 bg-destructive/15">
      <CardContent className="flex flex-col items-center gap-2.5 p-4">
        <p className="text-destructive text-sm">{error}</p>
        <Button onClick={onRetry} size="sm" variant="ghost">
          Try Again
        </Button>
      </CardContent>
    </Card>
  )
}
