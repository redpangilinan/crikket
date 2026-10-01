import {
  BUG_REPORT_STATUS_OPTIONS,
  type BugReportStatus,
} from "@crikket/shared/constants/bug-report"
import { Button } from "@crikket/ui/components/ui/button"
import { Separator } from "@crikket/ui/components/ui/separator"
import { Home } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { ExportDiagnosticsButton } from "./export-diagnostics-button"
import type { SharedBugReport } from "./types"

interface BugReportHeaderProps {
  data: SharedBugReport
  editAction?: ReactNode
}

function formatStatusLabel(status: BugReportStatus): string {
  switch (status) {
    case BUG_REPORT_STATUS_OPTIONS.inProgress:
      return "In Progress"
    case BUG_REPORT_STATUS_OPTIONS.resolved:
      return "Resolved"
    case BUG_REPORT_STATUS_OPTIONS.closed:
      return "Closed"
    default:
      return "Open"
  }
}

export function BugReportHeader({
  data,
  sidebarTrigger,
  editAction,
}: BugReportHeaderProps & { sidebarTrigger?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="md:hidden">{sidebarTrigger}</div>
        <Link
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          href="/"
        >
          <span className="font-semibold text-foreground">crikket</span>
        </Link>
        <Separator className="h-5 shrink-0" orientation="vertical" />
        <div className="flex min-w-0 items-center gap-2">
          <h1
            className="truncate font-medium text-sm"
            title={data.title ?? "Untitled"}
          >
            {data.title ?? "Untitled Bug Report"}
          </h1>
          <span className="hidden shrink-0 items-center rounded-full border bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground text-xs sm:inline-flex">
            {formatStatusLabel(data.status)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-muted-foreground text-xs sm:inline-block">
          {new Date(data.createdAt).toLocaleString()}
        </span>
        <Separator className="hidden sm:block" orientation="vertical" />
        <ExportDiagnosticsButton reportId={data.id} />
        {editAction}
        <Button
          nativeButton={false}
          render={
            <Link href="/">
              <Home />
              <span className="sr-only">Dashboard</span>
            </Link>
          }
          size="sm"
          variant="ghost"
        />
      </div>
    </header>
  )
}
