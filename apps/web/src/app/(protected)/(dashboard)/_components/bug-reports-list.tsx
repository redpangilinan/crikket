"use client"

import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { ConfirmationDialog } from "@crikket/ui/components/dialogs/confirmation-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Button } from "@crikket/ui/components/ui/button"
import { Card, CardContent } from "@crikket/ui/components/ui/card"
import { Checkbox } from "@crikket/ui/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { useInfiniteQuery, useMutation } from "@tanstack/react-query"
import {
  CheckSquare,
  Clock,
  Copy,
  Loader2,
  MoreVertical,
  Play,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { SelectionActionBar } from "@/components/selection-action-bar"
import { client, orpc } from "@/utils/orpc"

const PAGE_SIZE = 12

type ReportVisibility = "public" | "private"

export function BugReportsList() {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery(
    orpc.bugReport.list.infiniteOptions({
      initialPageParam: 1,
      input: (pageParam) => ({ page: pageParam, perPage: PAGE_SIZE }),
      getNextPageParam: (lastPage) =>
        lastPage.pagination.hasNextPage
          ? lastPage.pagination.page + 1
          : undefined,
    })
  )

  const reports = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  )

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => client.bugReport.delete({ id }),
    onSuccess: async () => {
      await refetch()
      toast.success("Report deleted")
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete report")
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => client.bugReport.deleteBulk({ ids }),
    onSuccess: async (result) => {
      setSelectedIds(new Set())
      await refetch()
      toast.success(`Deleted ${result.deletedCount} report(s)`)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete selected reports")
    },
  })

  const visibilityMutation = useMutation({
    mutationFn: async ({
      id,
      visibility,
    }: {
      id: string
      visibility: ReportVisibility
    }) => client.bugReport.updateVisibility({ id, visibility }),
    onSuccess: async (_, variables) => {
      await refetch()
      toast.success(`Set report to ${variables.visibility}`)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update visibility")
    },
  })

  useEffect(() => {
    const target = loadMoreRef.current
    if (!(target && hasNextPage) || isFetchingNextPage) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          fetchNextPage()
        }
      },
      { rootMargin: "300px 0px" }
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  useEffect(() => {
    setSelectedIds((previous) => {
      const availableIds = new Set(reports.map((report) => report.id))
      const next = new Set(
        Array.from(previous).filter((id) => availableIds.has(id))
      )
      return next.size === previous.size ? previous : next
    })
  }, [reports])

  const selectedCount = selectedIds.size
  const isMutating =
    deleteMutation.isPending ||
    bulkDeleteMutation.isPending ||
    visibilityMutation.isPending

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

  const handleCopyLink = async (id: string) => {
    const shareUrl = `${window.location.origin}/s/${id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success("Share link copied")
    } catch (error) {
      reportNonFatalError("Failed to copy bug report share link", error)
      toast.error("Failed to copy link")
    }
  }

  const handleSingleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id)
    setSelectedIds((previous) => {
      const next = new Set(previous)
      next.delete(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size < 1) {
      return
    }
    await bulkDeleteMutation.mutateAsync(Array.from(selectedIds))
  }

  const requestSingleDelete = (id: string) => {
    setDeleteReportId(id)
  }

  const requestBulkDelete = () => {
    if (selectedIds.size < 1) {
      return
    }
    setBulkDeleteOpen(true)
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            className="aspect-video w-full animate-pulse rounded-lg bg-muted"
            key={i}
          />
        ))}
      </div>
    )
  }

  if (!data || reports.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Play className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="font-semibold text-2xl">No bug reports yet</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Start reporting bugs to see them here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SelectionActionBar
        actions={
          <Button
            disabled={isMutating}
            onClick={requestBulkDelete}
            size="sm"
            variant="destructive"
          >
            <Trash2 className="size-4" />
            Delete selected
          </Button>
        }
        onClearSelection={() => setSelectedIds(new Set())}
        selectedCount={selectedCount}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {reports.map((report) => {
          const isChecked = selectedIds.has(report.id)
          const isPrivate = report.visibility === "private"

          return (
            <Card
              className="group relative overflow-hidden p-0 transition-all hover:shadow-lg"
              key={report.id}
            >
              <Link
                aria-label={`Open ${report.title}`}
                className="absolute inset-0 z-10"
                href={`/s/${report.id}`}
              />
              <CardContent className="p-0">
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <div className="absolute top-2 left-2 z-20">
                    <Checkbox
                      aria-label={`Select ${report.title}`}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        toggleSelection(report.id, checked === true)
                      }
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                    />
                  </div>

                  <div className="absolute top-2 right-2 z-20">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                        }}
                        render={
                          <Button
                            aria-label="Report actions"
                            className="h-8 w-8 bg-background/90 backdrop-blur-sm"
                            disabled={isMutating}
                            size="icon-sm"
                            variant="outline"
                          />
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => handleCopyLink(report.id)}
                        >
                          <Copy className="size-4" />
                          Copy link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          onValueChange={(value) => {
                            if (
                              (value === "public" || value === "private") &&
                              value !== report.visibility
                            ) {
                              visibilityMutation.mutate({
                                id: report.id,
                                visibility: value,
                              })
                            }
                          }}
                          value={report.visibility}
                        >
                          <DropdownMenuRadioItem value="private">
                            Private
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="public">
                            Public
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            requestSingleDelete(report.id)
                          }}
                          variant="destructive"
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {report.thumbnail ? (
                    <Image
                      alt={report.title}
                      className="object-cover transition-transform group-hover:scale-105"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 20vw"
                      src={report.thumbnail}
                    />
                  ) : report.attachmentType === "video" &&
                    report.attachmentUrl ? (
                    <>
                      <video
                        autoPlay
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loop
                        muted
                        playsInline
                        src={report.attachmentUrl}
                      />
                      <div className="absolute inset-0 bg-black/10" />
                    </>
                  ) : report.attachmentType === "screenshot" &&
                    report.attachmentUrl ? (
                    <Image
                      alt={report.title}
                      className="object-cover transition-transform group-hover:scale-105"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 20vw"
                      src={report.attachmentUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Play className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}

                  {report.attachmentType === "video" ? (
                    <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-white text-xs">
                      <Clock className="h-3 w-3" />
                      {report.duration}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-start gap-3 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      alt={report.uploader.name}
                      src={report.uploader.avatar}
                    />
                    <AvatarFallback>
                      {report.uploader.name
                        ?.split(" ")
                        .map((namePart: string) => namePart[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <h3 className="line-clamp-1 font-semibold text-sm leading-tight">
                      {report.title}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {report.uploader.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs">
                      <CheckSquare className="size-3.5" />
                      {isPrivate ? "Private" : "Public"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {isFetching ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      <div aria-hidden className="h-1 w-full" ref={loadMoreRef} />

      <ConfirmationDialog
        confirmText="Delete report"
        description="This action will permanently remove the bug report and its attachment from storage."
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteReportId) {
            return
          }
          await handleSingleDelete(deleteReportId)
          setDeleteReportId(null)
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteReportId(null)
          }
        }}
        open={deleteReportId !== null}
        title="Delete this report?"
        variant="destructive"
      />

      <ConfirmationDialog
        confirmText="Delete selected"
        description={`This action will permanently remove ${selectedCount} selected report${selectedCount === 1 ? "" : "s"} and their attachments from storage.`}
        isLoading={bulkDeleteMutation.isPending}
        onConfirm={handleBulkDelete}
        onOpenChange={setBulkDeleteOpen}
        open={bulkDeleteOpen}
        title={`Delete ${selectedCount} selected report${selectedCount === 1 ? "" : "s"}?`}
        variant="destructive"
      />
    </div>
  )
}
