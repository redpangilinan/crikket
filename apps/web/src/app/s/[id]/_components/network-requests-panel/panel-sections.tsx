import { Button } from "@crikket/ui/components/ui/button"
import { Separator } from "@crikket/ui/components/ui/separator"
import { Check, Copy } from "lucide-react"

import type { BodyPreview, KeyValueItem } from "./types"

interface KeyValueSectionProps {
  title: string
  items: KeyValueItem[]
  emptyMessage: string
}

interface PayloadSectionProps {
  title: string
  payload: BodyPreview | null
  onCopy: () => void
  copied: boolean
}

export function KeyValueSection({
  title,
  items,
  emptyMessage,
}: KeyValueSectionProps) {
  return (
    <section className="space-y-1.5 rounded-lg border bg-background p-2">
      <div className="flex items-center justify-between">
        <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <span className="font-mono text-[10px] text-muted-foreground">
          {items.length}
        </span>
      </div>
      <Separator />
      {items.length === 0 ? (
        <p className="py-3 text-center font-mono text-[11px] text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="max-h-44 overflow-auto rounded border bg-muted/30">
          {items.map((item) => (
            <div
              className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-2 border-b px-2 py-1.5 font-mono text-[11px] last:border-b-0"
              key={item.id}
            >
              <span className="break-all text-foreground">{item.key}</span>
              <span className="break-all text-muted-foreground">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function PayloadSection({
  title,
  payload,
  onCopy,
  copied,
}: PayloadSectionProps) {
  return (
    <section className="space-y-1.5 rounded-lg border bg-background p-2">
      <div className="flex items-center justify-between">
        <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <Button
          aria-label={`Copy ${title}`}
          onClick={onCopy}
          size="icon-xs"
          variant="ghost"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <Separator />
      {payload ? (
        <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-2 font-mono text-[11px] text-foreground leading-relaxed">
          {payload.formatted}
        </pre>
      ) : (
        <p className="py-3 text-center font-mono text-[11px] text-muted-foreground">
          No payload captured.
        </p>
      )}
    </section>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center p-4 text-center">
      <p className="font-mono text-[11px] text-muted-foreground">{message}</p>
    </div>
  )
}
