import { cn } from "@crikket/ui/lib/utils"
import type { ReactNode } from "react"
import type { DebuggerTimelineEntry } from "./types"
import { formatOffset } from "./utils"

interface TimelineListProps {
  entries: DebuggerTimelineEntry[]
  activeId: string | null
  onSelect: (e: DebuggerTimelineEntry) => void
  emptyMessage: string
  icon: ReactNode
}

export function TimelineList({
  entries,
  activeId,
  onSelect,
  emptyMessage,
  icon,
}: TimelineListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <div className="mb-2 rounded-full bg-muted p-2 opacity-50">{icon}</div>
        <p className="text-xs">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="divide-y border-t bg-background">
      {entries.map((entry) => {
        const isActive = entry.id === activeId
        return (
          <button
            className={cn(
              "flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none",
              isActive && "bg-muted/50 shadow-[inset_2px_0_0_0] shadow-primary"
            )}
            key={entry.id}
            onClick={() => onSelect(entry)}
            type="button"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span
                className={cn(
                  "font-medium font-mono text-xs",
                  entry.label.includes("error") || entry.label.includes("fail")
                    ? "text-destructive"
                    : "text-foreground"
                )}
              >
                {entry.label}
              </span>
              {typeof entry.offset === "number" && (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {formatOffset(entry.offset)}
                </span>
              )}
            </div>
            <p className="line-clamp-2 break-all font-mono text-muted-foreground text-xs">
              {entry.detail}
            </p>
          </button>
        )
      })}
    </div>
  )
}
