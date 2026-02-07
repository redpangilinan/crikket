import { FileText } from "lucide-react"
import { forwardRef } from "react"
import type { SharedBugReport } from "./types"

interface BugReportCanvasProps {
  data: SharedBugReport
  onTimeUpdate?: (currentTimeMs: number) => void
}

export const BugReportCanvas = forwardRef<
  HTMLVideoElement,
  BugReportCanvasProps
>(({ data, onTimeUpdate }, ref) => {
  const showVideo =
    data.attachmentType === "video" && Boolean(data.attachmentUrl)
  const showImage =
    data.attachmentType === "screenshot" && Boolean(data.attachmentUrl)

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted/20 p-4 md:p-8">
      <div className="relative flex h-full w-full max-w-7xl items-center justify-center">
        {showVideo ? (
          // biome-ignore lint/a11y/useMediaCaption: uploaded bug recordings do not have caption tracks yet
          <video
            className="max-h-full max-w-full rounded-lg bg-black object-contain shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            controls
            onTimeUpdate={(event) => {
              onTimeUpdate?.(event.currentTarget.currentTime * 1000)
            }}
            ref={ref}
            src={data.attachmentUrl ?? undefined}
          />
        ) : showImage ? (
          <img
            alt={data.title ?? "Bug report attachment"}
            className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
            src={data.attachmentUrl ?? undefined}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-background/50 p-8 text-muted-foreground">
            <FileText className="h-8 w-8 opacity-50" />
            <p className="text-sm">No visual attachment available</p>
          </div>
        )}
      </div>
    </div>
  )
})

BugReportCanvas.displayName = "BugReportCanvas"
