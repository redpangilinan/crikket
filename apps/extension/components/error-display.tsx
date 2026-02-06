import { Button } from "@crikket/ui/components/ui/button"

interface ErrorDisplayProps {
  error: string | null
  onRetry: () => void
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  if (!error) return null

  return (
    <div className="space-y-4 rounded-lg border border-red-500/20 bg-red-500/10 p-6">
      <div className="text-center">
        <span className="text-5xl">⚠️</span>
        <h3 className="mt-4 font-semibold text-red-400 text-xl">
          Something went wrong
        </h3>
        <p className="mt-2 text-red-300 text-sm">{error}</p>
      </div>
      <Button
        className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10"
        onClick={onRetry}
        variant="outline"
      >
        Try Again
      </Button>
    </div>
  )
}
