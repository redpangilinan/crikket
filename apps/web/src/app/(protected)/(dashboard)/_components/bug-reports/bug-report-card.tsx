"use client"

import type { BugReportVisibility } from "@crikket/shared/constants/bug-report"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Badge } from "@crikket/ui/components/ui/badge"
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
  Clapperboard,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  ImageIcon,
  MoreVertical,
  Play,
  Shield,
  Tag,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import {
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { EditBugReportSheet } from "@/components/bug-reports/edit-bug-report-sheet"

import {
  formatPriorityLabel,
  formatStatusLabel,
  VISIBILITY_OPTIONS,
} from "./filters"
import type { BugReportListItem } from "./types"

interface BugReportCardProps {
  report: BugReportListItem
  isChecked: boolean
  isMutating: boolean
  onToggleSelection: (checked: boolean) => void
  onRequestDelete: () => void
  onReportUpdated: () => Promise<void>
  onUpdateReport: (input: { visibility?: BugReportVisibility }) => void
}

export function BugReportCard({
  report,
  isChecked,
  isMutating,
  onToggleSelection,
  onRequestDelete,
  onReportUpdated,
  onUpdateReport,
}: BugReportCardProps) {
  const isPrivate = report.visibility === "private"
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)

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
                  <DropdownMenuLabel>Privacy</DropdownMenuLabel>
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
                <DropdownMenuItem onClick={() => setIsEditSheetOpen(true)}>
                  <Edit3 className="size-4" />
                  Edit report
                </DropdownMenuItem>
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

          <div className="pointer-events-none absolute bottom-2 left-2 z-20">
            <MediaTypeBadge attachmentType={report.attachmentType} />
          </div>

          {report.attachmentType === "video" ? (
            <div className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-white text-xs">
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
      <EditBugReportSheet
        onOpenChange={setIsEditSheetOpen}
        onUpdated={onReportUpdated}
        open={isEditSheetOpen}
        report={{
          id: report.id,
          title: report.title,
          tags: report.tags,
          status: report.status,
          priority: report.priority,
          visibility: report.visibility,
        }}
      />
    </Card>
  )
}

function MediaTypeBadge({
  attachmentType,
}: {
  attachmentType: BugReportListItem["attachmentType"]
}) {
  if (attachmentType === "video") {
    return (
      <Badge className="border-white/15 bg-black/75 text-white backdrop-blur-sm hover:bg-black/75">
        <Clapperboard className="size-3" />
        Video
      </Badge>
    )
  }

  if (attachmentType === "screenshot") {
    return (
      <Badge className="border-white/15 bg-black/75 text-white backdrop-blur-sm hover:bg-black/75">
        <ImageIcon className="size-3" />
        Screenshot
      </Badge>
    )
  }

  return null
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
    return <VideoThumbnail report={report} />
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

function VideoThumbnail({ report }: { report: BugReportListItem }) {
  const hasSeekedRef = useRef(false)

  const handleLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (hasSeekedRef.current) {
        return
      }

      const player = event.currentTarget
      const durationSeconds =
        Number.isFinite(player.duration) && player.duration > 0
          ? player.duration
          : 0
      const targetSeconds =
        durationSeconds > 0
          ? Math.min(Math.max(durationSeconds * 0.2, 0.15), durationSeconds / 2)
          : 0

      hasSeekedRef.current = true

      if (targetSeconds <= 0) {
        return
      }

      const handleSeeked = () => {
        player.pause()
      }

      player.addEventListener("seeked", handleSeeked, { once: true })

      try {
        player.currentTime = targetSeconds
      } catch {
        hasSeekedRef.current = false
      }
    },
    []
  )

  return (
    <>
      <video
        aria-hidden="true"
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
        muted
        onLoadedMetadata={handleLoadedMetadata}
        playsInline
        preload="metadata"
        src={report.attachmentUrl}
        tabIndex={-1}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="rounded-full border border-white/20 bg-black/60 p-3 text-white shadow-sm backdrop-blur-sm">
          <Play className="size-5 fill-current" />
        </div>
      </div>
    </>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px]">
      {children}
    </span>
  )
}
