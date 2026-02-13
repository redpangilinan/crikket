"use client"

import type {
  BugReportStatus,
  BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import type { Priority } from "@crikket/shared/constants/priorities"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { client } from "@/utils/orpc"
import { parseTagInput } from "../_components/bug-reports/utils"

interface UseBugReportsActionsInput {
  reportIds: string[]
  refetchAll: () => Promise<void>
}

export function useBugReportsActions({
  reportIds,
  refetchAll,
}: UseBugReportsActionsInput) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const [bulkStatus, setBulkStatus] = useState<BugReportStatus | "">("")
  const [bulkPriority, setBulkPriority] = useState<Priority | "">("")
  const [bulkVisibility, setBulkVisibility] = useState<
    BugReportVisibility | ""
  >("")
  const [bulkTagsInput, setBulkTagsInput] = useState("")

  useEffect(() => {
    setSelectedIds((previous) => {
      const availableIds = new Set(reportIds)
      const next = new Set(
        Array.from(previous).filter((id) => availableIds.has(id))
      )
      return next.size === previous.size ? previous : next
    })
  }, [reportIds])

  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds])
  const selectedCount = selectedIds.size

  const resetBulkInputs = () => {
    setBulkStatus("")
    setBulkPriority("")
    setBulkVisibility("")
    setBulkTagsInput("")
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => client.bugReport.delete({ id }),
    onSuccess: async (_, id) => {
      setSelectedIds((previous) => {
        const next = new Set(previous)
        next.delete(id)
        return next
      })
      await refetchAll()
      toast.success("Report deleted")
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || "Failed to delete report")
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => client.bugReport.deleteBulk({ ids }),
    onSuccess: async (result) => {
      setSelectedIds(new Set())
      await refetchAll()
      toast.success(`Deleted ${result.deletedCount} report(s)`)
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || "Failed to delete selected reports")
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (input: {
      id: string
      status?: BugReportStatus
      priority?: Priority
      visibility?: BugReportVisibility
    }) => client.bugReport.update(input),
    onSuccess: async () => {
      await refetchAll()
      toast.success("Report updated")
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || "Failed to update report")
    },
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: async (input: {
      ids: string[]
      status?: BugReportStatus
      priority?: Priority
      visibility?: BugReportVisibility
      tags?: string[]
    }) => client.bugReport.updateBulk(input),
    onSuccess: async (result) => {
      await refetchAll()
      toast.success(`Updated ${result.updatedCount} report(s)`)
      resetBulkInputs()
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || "Failed to update selected reports")
    },
  })

  const isMutating =
    deleteMutation.isPending ||
    bulkDeleteMutation.isPending ||
    updateMutation.isPending ||
    bulkUpdateMutation.isPending

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIdList.length < 1) {
      return
    }

    await bulkDeleteMutation.mutateAsync(selectedIdList)
  }

  const handleBulkUpdate = async () => {
    if (selectedIdList.length < 1) {
      return
    }

    const tags = parseTagInput(bulkTagsInput)
    const hasUpdate =
      Boolean(bulkStatus) ||
      Boolean(bulkPriority) ||
      Boolean(bulkVisibility) ||
      tags.length > 0

    if (!hasUpdate) {
      toast.error("Select at least one update field")
      return
    }

    await bulkUpdateMutation.mutateAsync({
      ids: selectedIdList,
      status: bulkStatus || undefined,
      priority: bulkPriority || undefined,
      visibility: bulkVisibility || undefined,
      tags: tags.length > 0 ? tags : undefined,
    })
  }

  return {
    selectedIds,
    selectedCount,
    clearSelection: () => setSelectedIds(new Set()),
    toggleSelection,
    selectedIdList,

    deleteReportId,
    setDeleteReportId,
    bulkDeleteOpen,
    setBulkDeleteOpen,

    bulkStatus,
    setBulkStatus,
    bulkPriority,
    setBulkPriority,
    bulkVisibility,
    setBulkVisibility,
    bulkTagsInput,
    setBulkTagsInput,

    isMutating,
    updateMutation,
    deleteMutation,
    bulkDeleteMutation,
    handleBulkDelete,
    handleBulkUpdate,
  }
}
