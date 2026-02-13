"use client"

import { ConfirmationDialog } from "@crikket/ui/components/dialogs/confirmation-dialog"

interface BugReportsDeleteDialogsProps {
  deleteReportId: string | null
  selectedCount: number
  bulkDeleteOpen: boolean
  isSingleDeleteLoading: boolean
  isBulkDeleteLoading: boolean
  onSingleDeleteConfirm: () => Promise<void>
  onSingleDeleteOpenChange: (open: boolean) => void
  onBulkDeleteConfirm: () => Promise<void>
  onBulkDeleteOpenChange: (open: boolean) => void
}

export function BugReportsDeleteDialogs({
  deleteReportId,
  selectedCount,
  bulkDeleteOpen,
  isSingleDeleteLoading,
  isBulkDeleteLoading,
  onSingleDeleteConfirm,
  onSingleDeleteOpenChange,
  onBulkDeleteConfirm,
  onBulkDeleteOpenChange,
}: BugReportsDeleteDialogsProps) {
  return (
    <>
      <ConfirmationDialog
        confirmText="Delete report"
        description="This action will permanently remove the bug report and its attachment from storage."
        isLoading={isSingleDeleteLoading}
        onConfirm={onSingleDeleteConfirm}
        onOpenChange={onSingleDeleteOpenChange}
        open={deleteReportId !== null}
        title="Delete this report?"
        variant="destructive"
      />

      <ConfirmationDialog
        confirmText="Delete selected"
        description={`This action will permanently remove ${selectedCount} selected report${selectedCount === 1 ? "" : "s"} and their attachments from storage.`}
        isLoading={isBulkDeleteLoading}
        onConfirm={onBulkDeleteConfirm}
        onOpenChange={onBulkDeleteOpenChange}
        open={bulkDeleteOpen}
        title={`Delete ${selectedCount} selected report${selectedCount === 1 ? "" : "s"}?`}
        variant="destructive"
      />
    </>
  )
}
