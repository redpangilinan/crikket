import {
  BUG_REPORT_SORT_OPTIONS,
  BUG_REPORT_STATUS_OPTIONS,
  BUG_REPORT_VISIBILITY_OPTIONS,
  type BugReportSort,
  type BugReportStatus,
  type BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"

export const STATUS_OPTIONS: Array<{ value: BugReportStatus; label: string }> =
  [
    { value: BUG_REPORT_STATUS_OPTIONS.open, label: "Open" },
    { value: BUG_REPORT_STATUS_OPTIONS.inProgress, label: "In Progress" },
    { value: BUG_REPORT_STATUS_OPTIONS.resolved, label: "Resolved" },
    { value: BUG_REPORT_STATUS_OPTIONS.closed, label: "Closed" },
  ]

export const PRIORITY_FILTER_OPTIONS: Array<{
  value: Priority
  label: string
}> = [
  { value: PRIORITY_OPTIONS.critical, label: "Critical" },
  { value: PRIORITY_OPTIONS.high, label: "High" },
  { value: PRIORITY_OPTIONS.medium, label: "Medium" },
  { value: PRIORITY_OPTIONS.low, label: "Low" },
  { value: PRIORITY_OPTIONS.none, label: "None" },
]

export const VISIBILITY_OPTIONS: Array<{
  value: BugReportVisibility
  label: string
}> = [
  { value: BUG_REPORT_VISIBILITY_OPTIONS.private, label: "Private" },
  { value: BUG_REPORT_VISIBILITY_OPTIONS.public, label: "Public" },
]

export const SORT_OPTIONS: Array<{ value: BugReportSort; label: string }> = [
  { value: BUG_REPORT_SORT_OPTIONS.newest, label: "Newest" },
  { value: BUG_REPORT_SORT_OPTIONS.oldest, label: "Oldest" },
  { value: BUG_REPORT_SORT_OPTIONS.updated, label: "Recently Updated" },
  {
    value: BUG_REPORT_SORT_OPTIONS.priorityHigh,
    label: "Priority: High to Low",
  },
  {
    value: BUG_REPORT_SORT_OPTIONS.priorityLow,
    label: "Priority: Low to High",
  },
]

export interface DashboardFilters {
  statuses: BugReportStatus[]
  priorities: Priority[]
  visibilities: BugReportVisibility[]
}

export const EMPTY_FILTERS: DashboardFilters = {
  statuses: [],
  priorities: [],
  visibilities: [],
}

export function formatStatusLabel(status: BugReportStatus): string {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
  )
}

export function formatPriorityLabel(priority: Priority): string {
  return (
    PRIORITY_FILTER_OPTIONS.find((option) => option.value === priority)
      ?.label ?? priority
  )
}

export function formatVisibilityLabel(visibility: BugReportVisibility): string {
  return (
    VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ??
    visibility
  )
}
