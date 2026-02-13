"use client"

import {
  BUG_REPORT_SORT_OPTIONS,
  type BugReportSort,
} from "@crikket/shared/constants/bug-report"
import { useDebounce } from "@crikket/ui/hooks/use-debounce"
import { useMemo, useState } from "react"

import {
  type DashboardFilters,
  EMPTY_FILTERS,
} from "../_components/bug-reports/filters"
import { toggleValue } from "../_components/bug-reports/utils"

export function useBugReportsFilters() {
  const [searchValue, setSearchValue] = useState("")
  const debouncedSearch = useDebounce(searchValue, 300)
  const [sort, setSort] = useState<BugReportSort>(
    BUG_REPORT_SORT_OPTIONS.newest
  )
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS)

  const hasFilters = useMemo(
    () =>
      filters.statuses.length > 0 ||
      filters.priorities.length > 0 ||
      filters.visibilities.length > 0,
    [filters]
  )

  return {
    searchValue,
    setSearchValue,
    debouncedSearch,
    sort,
    setSort,
    filters,
    clearFilters: () => setFilters(EMPTY_FILTERS),
    resetFiltersAndSearch: () => {
      setSearchValue("")
      setFilters(EMPTY_FILTERS)
    },
    hasActiveFilters: hasFilters || debouncedSearch.length > 0,
    toggleStatus: (value: DashboardFilters["statuses"][number]) =>
      setFilters((previous) => ({
        ...previous,
        statuses: toggleValue(previous.statuses, value),
      })),
    togglePriority: (value: DashboardFilters["priorities"][number]) =>
      setFilters((previous) => ({
        ...previous,
        priorities: toggleValue(previous.priorities, value),
      })),
    toggleVisibility: (value: DashboardFilters["visibilities"][number]) =>
      setFilters((previous) => ({
        ...previous,
        visibilities: toggleValue(previous.visibilities, value),
      })),
  }
}
