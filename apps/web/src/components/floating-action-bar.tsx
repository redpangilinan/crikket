"use client"

import { cn } from "@crikket/ui/lib/utils"
import type { ReactNode } from "react"

interface FloatingActionBarProps {
  visible: boolean
  title: ReactNode
  actions: ReactNode
  className?: string
}

export function FloatingActionBar({
  visible,
  title,
  actions,
  className,
}: FloatingActionBarProps) {
  if (!visible) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 px-2 sm:bottom-4 sm:px-4">
      <div
        className={cn(
          "pointer-events-auto mx-auto w-full max-w-5xl rounded-2xl border bg-background/95 p-2.5 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:p-3",
          className
        )}
      >
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="font-medium text-sm">{title}</div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}
