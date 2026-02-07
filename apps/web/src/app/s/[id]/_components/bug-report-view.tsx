"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { orpc } from "@/utils/orpc"
import { DebuggerSection } from "./debugger-section"
import type { DebuggerTimelineEntry } from "./types"
import {
  buildActionEntry,
  buildLogEntry,
  buildNetworkEntry,
  getPlaybackEntryId,
  normalizeDebuggerData,
} from "./utils"

interface BugReportViewProps {
  id: string
}

export function BugReportView({ id }: BugReportViewProps) {
  const { data, isLoading, error } = useQuery(
    orpc.bugReport.getById.queryOptions({
      input: { id },
      enabled: Boolean(id),
    })
  )

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playbackOffsetMs, setPlaybackOffsetMs] = useState(0)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const showVideo =
    data?.attachmentType === "video" && Boolean(data.attachmentUrl)
  const showImage =
    data?.attachmentType === "screenshot" && Boolean(data.attachmentUrl)

  const debuggerData = normalizeDebuggerData(data?.debugger)

  const actionEntries = useMemo(
    () => debuggerData.actions.map(buildActionEntry),
    [debuggerData.actions]
  )
  const logEntries = useMemo(
    () => debuggerData.logs.map(buildLogEntry),
    [debuggerData.logs]
  )
  const networkEntries = useMemo(
    () => debuggerData.networkRequests.map(buildNetworkEntry),
    [debuggerData.networkRequests]
  )

  const allEntries = useMemo(
    () => [...actionEntries, ...logEntries, ...networkEntries],
    [actionEntries, logEntries, networkEntries]
  )

  const playbackEntryId = useMemo(
    () =>
      getPlaybackEntryId({
        showVideo,
        playbackOffsetMs,
        entries: allEntries,
      }),
    [allEntries, playbackOffsetMs, showVideo]
  )

  const hasDebuggerEvents = allEntries.length > 0
  const activeEntryId = selectedEntryId ?? playbackEntryId

  const handleEntrySelect = (entry: DebuggerTimelineEntry) => {
    setSelectedEntryId(entry.id)

    if (!showVideo) {
      return
    }

    if (!videoRef.current || typeof entry.offset !== "number") {
      return
    }

    videoRef.current.currentTime = entry.offset / 1000
    setPlaybackOffsetMs(entry.offset)

    videoRef.current.play().catch(() => {
      // Keep the seek interaction resilient if autoplay is blocked.
    })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h1 className="font-semibold text-xl">Bug report not found</h1>
              <p className="text-muted-foreground text-sm">
                This share link is invalid or the report was removed.
              </p>
            </div>
            <Link
              className="font-medium text-primary text-sm underline"
              href="/"
            >
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl">
          {data.title ?? "Untitled Bug Report"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Report ID: {data.id} • {new Date(data.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <CardContent className="p-0">
              {showVideo ? (
                <>
                  {/* biome-ignore lint/a11y/useMediaCaption: uploaded bug recordings do not have caption tracks yet */}
                  <video
                    className="h-auto max-h-[70vh] w-full bg-black"
                    controls
                    onTimeUpdate={(event) => {
                      setPlaybackOffsetMs(
                        event.currentTarget.currentTime * 1000
                      )
                    }}
                    ref={videoRef}
                    src={data.attachmentUrl ?? undefined}
                  />
                </>
              ) : null}

              {showImage ? (
                <img
                  alt={data.title ?? "Bug report attachment"}
                  className="h-auto w-full object-contain"
                  src={data.attachmentUrl ?? undefined}
                />
              ) : null}

              {showVideo || showImage ? null : (
                <div className="flex min-h-[280px] items-center justify-center bg-muted p-6 text-center text-muted-foreground text-sm">
                  No attachment available for this report.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Status:</span> {data.status}
                </p>
                <p>
                  <span className="font-medium">Priority:</span> {data.priority}
                </p>
                <p>
                  <span className="font-medium">Reporter:</span>{" "}
                  {data.reporter?.name ?? "Unknown"}
                </p>
                <p>
                  <span className="font-medium">Organization:</span>{" "}
                  {data.organization.name}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="break-all">
                  <span className="font-medium">URL:</span> {data.url ?? "N/A"}
                </p>
                <p>
                  <span className="font-medium">Attachment Type:</span>{" "}
                  {data.attachmentType ?? "N/A"}
                </p>
                <p className="text-muted-foreground">
                  {data.description ?? "No description provided."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Debugger Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {hasDebuggerEvents ? (
                <p className="text-muted-foreground text-xs">
                  Select any entry to jump to the matching moment in the
                  recording.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  No debugger events were captured for this report.
                </p>
              )}
            </CardContent>
          </Card>

          <DebuggerSection
            activeEntryId={activeEntryId}
            emptyState="No reproduction steps captured."
            entries={actionEntries}
            onSelect={handleEntrySelect}
            title="Reproduction Steps"
          />

          <DebuggerSection
            activeEntryId={activeEntryId}
            emptyState="No console logs captured."
            entries={logEntries}
            onSelect={handleEntrySelect}
            title="Console Logs"
          />

          <DebuggerSection
            activeEntryId={activeEntryId}
            emptyState="No network requests captured."
            entries={networkEntries}
            onSelect={handleEntrySelect}
            title="Network Requests"
          />
        </div>
      </div>
    </div>
  )
}
