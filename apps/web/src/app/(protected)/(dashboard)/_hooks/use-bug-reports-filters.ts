"use client"

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
import { useDebounce } from "@crikket/ui/hooks/use-debounce"
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { useEffect, useMemo, useState } from "react"

import type { DashboardFilters } from "../_components/bug-reports/filters"
import { toggleValue } from "../_components/bug-reports/utils"

const STATUS_VALUES = [
  BUG_REPORT_STATUS_OPTIONS.open,
  BUG_REPORT_STATUS_OPTIONS.inProgress,
  BUG_REPORT_STATUS_OPTIONS.resolved,
  BUG_REPORT_STATUS_OPTIONS.closed,
] as const satisfies readonly BugReportStatus[]

const PRIORITY_VALUES = [
  PRIORITY_OPTIONS.critical,
  PRIORITY_OPTIONS.high,
  PRIORITY_OPTIONS.medium,
  PRIORITY_OPTIONS.low,
  PRIORITY_OPTIONS.none,
] as const satisfies readonly Priority[]

const VISIBILITY_VALUES = [
  BUG_REPORT_VISIBILITY_OPTIONS.private,
  BUG_REPORT_VISIBILITY_OPTIONS.public,
] as const satisfies readonly BugReportVisibility[]

const SORT_VALUES = [
  BUG_REPORT_SORT_OPTIONS.newest,
  BUG_REPORT_SORT_OPTIONS.oldest,
  BUG_REPORT_SORT_OPTIONS.updated,
  BUG_REPORT_SORT_OPTIONS.priorityHigh,
  BUG_REPORT_SORT_OPTIONS.priorityLow,
] as const satisfies readonly BugReportSort[]

const EMPTY_DASHBOARD_FILTERS: DashboardFilters = {
  statuses: [],
  priorities: [],
  visibilities: [],
  assignee: "",
}

export function useBugReportsFilters() {
  const [
    { search, sort, statuses, priorities, visibilities, assignee },
    setFilterSearchQuery,
  ] = useQueryStates(
    {
      assignee: parseAsString
        .withOptions({ clearOnDefault: true })
        .withDefault(""),
      search: parseAsString
        .withOptions({ clearOnDefault: true })
        .withDefault(""),
      sort: parseAsStringLiteral(SORT_VALUES)
        .withOptions({ clearOnDefault: true })
        .withDefault(BUG_REPORT_SORT_OPTIONS.newest),
      statuses: parseAsArrayOf(parseAsStringLiteral(STATUS_VALUES))
        .withOptions({ clearOnDefault: true })
        .withDefault([]),
      priorities: parseAsArrayOf(parseAsStringLiteral(PRIORITY_VALUES))
        .withOptions({ clearOnDefault: true })
        .withDefault([]),
      visibilities: parseAsArrayOf(parseAsStringLiteral(VISIBILITY_VALUES))
        .withOptions({ clearOnDefault: true })
        .withDefault([]),
    },
    {
      history: "replace",
      shallow: false,
    }
  )
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounce(searchInput)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    if (debouncedSearch === search) {
      return
    }

    setFilterSearchQuery({ search: debouncedSearch }).catch(() => undefined)
  }, [debouncedSearch, search, setFilterSearchQuery])

  const filters = useMemo<DashboardFilters>(
    () => ({ statuses, priorities, visibilities, assignee }),
    [statuses, priorities, visibilities, assignee]
  )

  const hasFilters = useMemo(
    () =>
      filters.statuses.length > 0 ||
      filters.priorities.length > 0 ||
      filters.visibilities.length > 0 ||
      filters.assignee !== "",
    [filters]
  )

  return {
    searchValue: searchInput,
    setSearchValue: setSearchInput,
    debouncedSearch,
    sort,
    setSort: (value: BugReportSort) => {
      setFilterSearchQuery({ sort: value }).catch(() => undefined)
    },
    filters,
    setAssignee: (value: string) =>
      setFilterSearchQuery({ assignee: value }).catch(() => undefined),
    clearFilters: () => {
      setFilterSearchQuery({
        statuses: EMPTY_DASHBOARD_FILTERS.statuses,
        priorities: EMPTY_DASHBOARD_FILTERS.priorities,
        visibilities: EMPTY_DASHBOARD_FILTERS.visibilities,
        assignee: EMPTY_DASHBOARD_FILTERS.assignee,
      }).catch(() => undefined)
    },
    resetFiltersAndSearch: () => {
      setSearchInput("")
      setFilterSearchQuery({
        search: "",
        statuses: EMPTY_DASHBOARD_FILTERS.statuses,
        priorities: EMPTY_DASHBOARD_FILTERS.priorities,
        visibilities: EMPTY_DASHBOARD_FILTERS.visibilities,
        assignee: EMPTY_DASHBOARD_FILTERS.assignee,
      }).catch(() => undefined)
    },
    hasActiveFilters: hasFilters || debouncedSearch.length > 0,
    toggleStatus: (value: DashboardFilters["statuses"][number]) =>
      setFilterSearchQuery({
        statuses: toggleValue(filters.statuses, value),
      }).catch(() => undefined),
    togglePriority: (value: DashboardFilters["priorities"][number]) =>
      setFilterSearchQuery({
        priorities: toggleValue(filters.priorities, value),
      }).catch(() => undefined),
    toggleVisibility: (value: DashboardFilters["visibilities"][number]) =>
      setFilterSearchQuery({
        visibilities: toggleValue(filters.visibilities, value),
      }).catch(() => undefined),
  }
}
