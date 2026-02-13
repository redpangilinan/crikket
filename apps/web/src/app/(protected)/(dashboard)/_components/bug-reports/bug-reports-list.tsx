"use client"

import { Button } from "@crikket/ui/components/ui/button"
import { Loader2, Play } from "lucide-react"

import { SelectionActionBar } from "@/components/selection-action-bar"
import { useBugReportsActions } from "../../_hooks/use-bug-reports-actions"
import { useBugReportsData } from "../../_hooks/use-bug-reports-data"
import { useBugReportsFilters } from "../../_hooks/use-bug-reports-filters"
import { BugReportCard } from "./bug-report-card"
import { BugReportsBulkActions } from "./bug-reports-bulk-actions"
import { BugReportsDeleteDialogs } from "./bug-reports-delete-dialogs"
import { BugReportsToolbar } from "./bug-reports-toolbar"

export function BugReportsList() {
  const filtersState = useBugReportsFilters()

  const dataState = useBugReportsData({
    search: filtersState.debouncedSearch,
    sort: filtersState.sort,
    filters: filtersState.filters,
  })

  const actionsState = useBugReportsActions({
    reportIds: dataState.reports.map((report) => report.id),
    refetchAll: dataState.refetchAll,
  })

  return (
    <div
      className={
        actionsState.selectedCount > 0
          ? "space-y-4 pb-40 sm:pb-32 lg:pb-28"
          : "space-y-4"
      }
    >
      <BugReportsToolbar
        filters={filtersState.filters}
        onClearFilters={filtersState.clearFilters}
        onSearchChange={filtersState.setSearchValue}
        onSortChange={filtersState.setSort}
        onTogglePriority={filtersState.togglePriority}
        onToggleStatus={filtersState.toggleStatus}
        onToggleVisibility={filtersState.toggleVisibility}
        search={filtersState.searchValue}
        sort={filtersState.sort}
        stats={dataState.stats}
      />

      <SelectionActionBar
        actions={
          <BugReportsBulkActions
            bulkPriority={actionsState.bulkPriority}
            bulkStatus={actionsState.bulkStatus}
            bulkTagsInput={actionsState.bulkTagsInput}
            bulkVisibility={actionsState.bulkVisibility}
            isMutating={actionsState.isMutating}
            onApplyUpdates={actionsState.handleBulkUpdate}
            onBulkPriorityChange={actionsState.setBulkPriority}
            onBulkStatusChange={actionsState.setBulkStatus}
            onBulkTagsChange={actionsState.setBulkTagsInput}
            onBulkVisibilityChange={actionsState.setBulkVisibility}
            onRequestBulkDelete={() => actionsState.setBulkDeleteOpen(true)}
          />
        }
        onClearSelection={actionsState.clearSelection}
        selectedCount={actionsState.selectedCount}
      />

      {dataState.query.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-sm">Failed to load bug reports</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {dataState.query.error.message || "Unexpected error"}
          </p>
          <Button
            className="mt-3"
            onClick={() => dataState.query.refetch()}
            size="sm"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {dataState.query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              className="aspect-video w-full animate-pulse rounded-lg bg-muted"
              key={i}
            />
          ))}
        </div>
      ) : null}

      {!dataState.query.isLoading &&
      dataState.reports.length === 0 &&
      !dataState.query.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Play className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold text-2xl">
              {filtersState.hasActiveFilters
                ? "No matching reports"
                : "No bug reports yet"}
            </h2>
            <p className="mt-2 text-muted-foreground text-sm">
              {filtersState.hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Start reporting bugs to see them here."}
            </p>
          </div>
          {filtersState.hasActiveFilters ? (
            <Button
              onClick={filtersState.resetFiltersAndSearch}
              size="sm"
              variant="outline"
            >
              Reset view
            </Button>
          ) : null}
        </div>
      ) : null}

      {dataState.reports.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {dataState.reports.map((report) => (
            <BugReportCard
              isChecked={actionsState.selectedIds.has(report.id)}
              isMutating={actionsState.isMutating}
              key={report.id}
              onRequestDelete={() => actionsState.setDeleteReportId(report.id)}
              onToggleSelection={(checked) =>
                actionsState.toggleSelection(report.id, checked)
              }
              onUpdateReport={(input) =>
                actionsState.updateMutation.mutate({
                  id: report.id,
                  ...input,
                })
              }
              report={report}
            />
          ))}
        </div>
      ) : null}

      {dataState.query.isFetching ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      <div aria-hidden className="h-1 w-full" ref={dataState.loadMoreRef} />

      <BugReportsDeleteDialogs
        bulkDeleteOpen={actionsState.bulkDeleteOpen}
        deleteReportId={actionsState.deleteReportId}
        isBulkDeleteLoading={actionsState.bulkDeleteMutation.isPending}
        isSingleDeleteLoading={actionsState.deleteMutation.isPending}
        onBulkDeleteConfirm={actionsState.handleBulkDelete}
        onBulkDeleteOpenChange={actionsState.setBulkDeleteOpen}
        onSingleDeleteConfirm={async () => {
          if (!actionsState.deleteReportId) {
            return
          }

          await actionsState.deleteMutation.mutateAsync(
            actionsState.deleteReportId
          )
          actionsState.setDeleteReportId(null)
        }}
        onSingleDeleteOpenChange={(open) => {
          if (!open) {
            actionsState.setDeleteReportId(null)
          }
        }}
        selectedCount={actionsState.selectedCount}
      />
    </div>
  )
}
