export const BUG_REPORT_STATUS_OPTIONS = {
  open: "open",
  inProgress: "in_progress",
  resolved: "resolved",
  closed: "closed",
} as const

export type BugReportStatus =
  (typeof BUG_REPORT_STATUS_OPTIONS)[keyof typeof BUG_REPORT_STATUS_OPTIONS]

export const BUG_REPORT_VISIBILITY_OPTIONS = {
  public: "public",
  private: "private",
} as const

export type BugReportVisibility =
  (typeof BUG_REPORT_VISIBILITY_OPTIONS)[keyof typeof BUG_REPORT_VISIBILITY_OPTIONS]

export const BUG_REPORT_SORT_OPTIONS = {
  newest: "newest",
  oldest: "oldest",
  updated: "updated",
  priorityHigh: "priority_high",
  priorityLow: "priority_low",
} as const

export type BugReportSort =
  (typeof BUG_REPORT_SORT_OPTIONS)[keyof typeof BUG_REPORT_SORT_OPTIONS]
