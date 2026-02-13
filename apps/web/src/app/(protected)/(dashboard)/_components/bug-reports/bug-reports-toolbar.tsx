"use client"

import type {
  BugReportSort,
  BugReportStatus,
  BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import type { Priority } from "@crikket/shared/constants/priorities"
import { Button } from "@crikket/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { Input } from "@crikket/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import {
  Filter,
  Search,
  Shield,
  Tag,
  TriangleAlert,
  UserRound,
} from "lucide-react"
import type { ReactNode } from "react"

import {
  type DashboardFilters,
  formatPriorityLabel,
  formatStatusLabel,
  formatVisibilityLabel,
  PRIORITY_FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
} from "./filters"
import type { BugReportStats } from "./types"

interface BugReportsToolbarProps {
  search: string
  sort: BugReportSort
  filters: DashboardFilters
  stats?: BugReportStats
  onSearchChange: (value: string) => void
  onSortChange: (value: BugReportSort) => void
  onToggleStatus: (value: BugReportStatus) => void
  onTogglePriority: (value: Priority) => void
  onToggleVisibility: (value: BugReportVisibility) => void
  onClearFilters: () => void
}

function countActiveFilters(filters: DashboardFilters): number {
  return (
    filters.statuses.length +
    filters.priorities.length +
    filters.visibilities.length
  )
}

export function BugReportsToolbar({
  search,
  sort,
  filters,
  stats,
  onSearchChange,
  onSortChange,
  onToggleStatus,
  onTogglePriority,
  onToggleVisibility,
  onClearFilters,
}: BugReportsToolbarProps) {
  const activeFilters = countActiveFilters(filters)
  const selectedSortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort"

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, description, or URL"
            value={search}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            onValueChange={(value) => onSortChange(value as BugReportSort)}
            value={sort}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue>{selectedSortLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant="outline">
                  <Filter className="size-4" />
                  Filters
                  {activeFilters > 0 ? ` (${activeFilters})` : ""}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {STATUS_OPTIONS.map((status) => (
                  <DropdownMenuCheckboxItem
                    checked={filters.statuses.includes(status.value)}
                    key={status.value}
                    onCheckedChange={() => onToggleStatus(status.value)}
                  >
                    {status.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Priority</DropdownMenuLabel>
                {PRIORITY_FILTER_OPTIONS.map((priority) => (
                  <DropdownMenuCheckboxItem
                    checked={filters.priorities.includes(priority.value)}
                    key={priority.value}
                    onCheckedChange={() => onTogglePriority(priority.value)}
                  >
                    {priority.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Visibility</DropdownMenuLabel>
                {VISIBILITY_OPTIONS.map((visibility) => (
                  <DropdownMenuCheckboxItem
                    checked={filters.visibilities.includes(visibility.value)}
                    key={visibility.value}
                    onCheckedChange={() => onToggleVisibility(visibility.value)}
                  >
                    {visibility.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            disabled={activeFilters === 0}
            onClick={onClearFilters}
            size="sm"
            variant="ghost"
          >
            Clear filters
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatChip
          icon={<TriangleAlert className="size-3.5" />}
          label="Open"
          value={stats?.open ?? 0}
        />
        <StatChip
          icon={<Shield className="size-3.5" />}
          label="Untriaged"
          value={stats?.untriaged ?? 0}
        />
        <StatChip
          icon={<UserRound className="size-3.5" />}
          label="Mine"
          value={stats?.mine ?? 0}
        />
        <StatChip
          icon={<Tag className="size-3.5" />}
          label="Total"
          value={stats?.total ?? 0}
        />
        {filters.statuses.map((status) => (
          <Pill key={status}>{formatStatusLabel(status)}</Pill>
        ))}
        {filters.priorities.map((priority) => (
          <Pill key={priority}>{formatPriorityLabel(priority)}</Pill>
        ))}
        {filters.visibilities.map((visibility) => (
          <Pill key={visibility}>{formatVisibilityLabel(visibility)}</Pill>
        ))}
      </div>
    </div>
  )
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 font-medium text-xs">
      {icon}
      {label}: {value}
    </span>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border bg-muted px-2 py-1 text-xs">
      {children}
    </span>
  )
}
