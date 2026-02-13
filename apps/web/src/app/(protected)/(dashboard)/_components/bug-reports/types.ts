import type { AppRouterClient } from "@crikket/api/routers/index"

export type BugReportListResponse = Awaited<
  ReturnType<AppRouterClient["bugReport"]["list"]>
>

export type BugReportListItem = BugReportListResponse["items"][number]

export type BugReportStats = Awaited<
  ReturnType<AppRouterClient["bugReport"]["getDashboardStats"]>
>
