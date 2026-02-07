"use client"

import { Button } from "@crikket/ui/components/ui/button"
import type { ReactNode } from "react"

interface SelectionActionBarProps {
  selectedCount: number
  actions: ReactNode
  onClearSelection: () => void
}

export function SelectionActionBar({
  selectedCount,
  actions,
  onClearSelection,
}: SelectionActionBarProps) {
  if (selectedCount < 1) {
    return null
  }

  return (
    <div className="sticky top-0 z-30 rounded-md border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-sm">{selectedCount} selected</p>
        <div className="flex items-center gap-2">
          {actions}
          <Button onClick={onClearSelection} size="sm" variant="ghost">
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}
