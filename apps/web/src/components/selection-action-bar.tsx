"use client"

import { Button } from "@crikket/ui/components/ui/button"
import type { ReactNode } from "react"
import { FloatingActionBar } from "./floating-action-bar"

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
  return (
    <FloatingActionBar
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {actions}
          <Button
            className="flex-1 sm:flex-none"
            onClick={onClearSelection}
            size="sm"
            variant="ghost"
          >
            Clear
          </Button>
        </div>
      }
      title={`${selectedCount} selected`}
      visible={selectedCount > 0}
    />
  )
}
