"use client"

import type {
  BugReportStatus,
  BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import type { Priority } from "@crikket/shared/constants/priorities"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Button } from "@crikket/ui/components/ui/button"
import { Card, CardContent } from "@crikket/ui/components/ui/card"
import { Checkbox } from "@crikket/ui/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import {
  Clock,
  Copy,
  ExternalLink,
  MoreVertical,
  Play,
  Shield,
  Tag,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { toast } from "sonner"

import {
  formatPriorityLabel,
  formatStatusLabel,
  PRIORITY_FILTER_OPTIONS,
  STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
} from "./filters"
import type { BugReportListItem } from "./types"

interface BugReportCardProps {
  report: BugReportListItem
  isChecked: boolean
  isMutating: boolean
  onToggleSelection: (checked: boolean) => void
  onRequestDelete: () => void
  onUpdateReport: (input: {
    status?: BugReportStatus
    priority?: Priority
    visibility?: BugReportVisibility
  }) => void
}

export function BugReportCard({
  report,
  isChecked,
  isMutating,
  onToggleSelection,
  onRequestDelete,
  onUpdateReport,
}: BugReportCardProps) {
  const isPrivate = report.visibility === "private"

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/s/${report.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success("Share link copied")
    } catch (error) {
      reportNonFatalError("Failed to copy bug report share link", error)
      toast.error("Failed to copy link")
    }
  }

  return (
    <Card className="group relative overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
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
              onCheckedChange={(checked) => onToggleSelection(checked === true)}
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
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="size-4" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    window.open(`/s/${report.id}`, "_blank", "noopener")
                  }
                >
                  <ExternalLink className="size-4" />
                  Open in new tab
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    onValueChange={(value) => {
                      if (value !== report.status) {
                        onUpdateReport({ status: value as BugReportStatus })
                      }
                    }}
                    value={report.status}
                  >
                    {STATUS_OPTIONS.map((statusOption) => (
                      <DropdownMenuRadioItem
                        key={statusOption.value}
                        value={statusOption.value}
                      >
                        {statusOption.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Priority</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    onValueChange={(value) => {
                      if (value !== report.priority) {
                        onUpdateReport({ priority: value as Priority })
                      }
                    }}
                    value={report.priority}
                  >
                    {PRIORITY_FILTER_OPTIONS.map((priorityOption) => (
                      <DropdownMenuRadioItem
                        key={priorityOption.value}
                        value={priorityOption.value}
                      >
                        {priorityOption.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Visibility</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    onValueChange={(value) => {
                      if (value !== report.visibility) {
                        onUpdateReport({
                          visibility: value as BugReportVisibility,
                        })
                      }
                    }}
                    value={report.visibility}
                  >
                    {VISIBILITY_OPTIONS.map((visibilityOption) => (
                      <DropdownMenuRadioItem
                        key={visibilityOption.value}
                        value={visibilityOption.value}
                      >
                        {visibilityOption.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onRequestDelete}
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <MediaPreview report={report} />

          {report.attachmentType === "video" ? (
            <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-white text-xs">
              <Clock className="h-3 w-3" />
              {report.duration}
            </div>
          ) : null}
        </div>

        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3
                className="line-clamp-1 font-semibold text-sm leading-tight"
                title={report.title}
              >
                {report.title}
              </h3>
              <p className="text-muted-foreground text-xs">
                {new Date(report.createdAt).toLocaleString()}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-muted px-2 py-1 font-medium text-[11px]">
              <Shield className="size-3" />
              {isPrivate ? "Private" : "Public"}
            </span>
          </div>

          <p className="line-clamp-2 min-h-8 text-muted-foreground text-xs">
            {report.description || report.url || "No additional context"}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>{formatStatusLabel(report.status)}</Chip>
            <Chip>{formatPriorityLabel(report.priority)}</Chip>
            {report.tags.slice(0, 2).map((tag) => (
              <Chip key={tag}>
                <Tag className="size-3" />
                {tag}
              </Chip>
            ))}
            {report.tags.length > 2 ? (
              <Chip>+{report.tags.length - 2}</Chip>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MediaPreview({ report }: { report: BugReportListItem }) {
  if (report.thumbnail) {
    return (
      <Image
        alt={report.title}
        className="object-cover transition-transform group-hover:scale-105"
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 20vw"
        src={report.thumbnail}
      />
    )
  }

  if (report.attachmentType === "video" && report.attachmentUrl) {
    return (
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
    )
  }

  if (report.attachmentType === "screenshot" && report.attachmentUrl) {
    return (
      <Image
        alt={report.title}
        className="object-cover transition-transform group-hover:scale-105"
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 20vw"
        src={report.attachmentUrl}
      />
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Play className="h-12 w-12 text-muted-foreground" />
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px]">
      {children}
    </span>
  )
}
