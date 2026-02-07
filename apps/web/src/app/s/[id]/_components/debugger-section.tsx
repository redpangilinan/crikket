import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import type { DebuggerTimelineEntry } from "./types"
import { formatEventTimeLabel } from "./utils"

interface DebuggerSectionProps {
  title: string
  entries: DebuggerTimelineEntry[]
  activeEntryId: string | null
  emptyState: string
  onSelect: (entry: DebuggerTimelineEntry) => void
}

export function DebuggerSection({
  title,
  entries,
  activeEntryId,
  emptyState,
  onSelect,
}: DebuggerSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-xs">{emptyState}</p>
        ) : (
          entries.map((entry) => {
            const isActive = entry.id === activeEntryId
            return (
              <button
                className={`w-full rounded-md border p-3 text-left transition ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:bg-muted"
                }`}
                key={entry.id}
                onClick={() => onSelect(entry)}
                type="button"
              >
                <p className="font-medium text-sm">{entry.label}</p>
                <p className="mt-1 break-words text-muted-foreground text-xs">
                  {entry.detail}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {formatEventTimeLabel(entry)}
                </p>
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
