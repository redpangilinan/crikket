import { Button } from "@crikket/ui/components/ui/button"
import { Separator } from "@crikket/ui/components/ui/separator"
import Link from "next/link"
import type { SharedBugReport } from "./types"

interface BugReportHeaderProps {
  data: SharedBugReport
}

export function BugReportHeader({ data }: BugReportHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-4">
        <Link
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          href="/"
        >
          <span className="font-semibold text-foreground">crikket</span>
        </Link>
        <Separator className="h-4" orientation="vertical" />
        <div className="flex items-center gap-2">
          <h1
            className="max-w-[300px] truncate font-medium text-sm"
            title={data.title ?? "Untitled"}
          >
            {data.title ?? "Untitled Bug Report"}
          </h1>
          <span className="hidden items-center rounded-full border bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground text-xs sm:inline-flex">
            {data.status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden text-muted-foreground text-xs sm:inline-block">
          {new Date(data.createdAt).toLocaleString()}
        </span>
        <Separator className="hidden h-4 sm:block" orientation="vertical" />
        <Button
          nativeButton={false}
          render={<Link href="/">Dashboard</Link>}
          size="sm"
          variant="ghost"
        />
      </div>
    </header>
  )
}
