"use client"

import { Button } from "@crikket/ui/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { orpc } from "@/utils/orpc"

import { BugReportCanvas } from "./bug-report-canvas"
import { BugReportHeader } from "./bug-report-header"
import { BugReportSidebar, type SidebarTab } from "./bug-report-sidebar"
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
  const [activeTab, setActiveTab] = useState<SidebarTab>("details")

  const showVideo =
    data?.attachmentType === "video" && Boolean(data.attachmentUrl)

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
        showVideo: showVideo ?? false,
        playbackOffsetMs,
        entries: allEntries,
      }),
    [allEntries, playbackOffsetMs, showVideo]
  )

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
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div>
            <h1 className="font-semibold text-xl">Bug report not found</h1>
            <p className="text-muted-foreground text-sm">
              This share link is invalid or the report was removed.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <BugReportHeader data={data} />

      <div className="flex flex-1 overflow-hidden">
        <BugReportCanvas
          data={data}
          onTimeUpdate={setPlaybackOffsetMs}
          ref={videoRef}
        />

        <BugReportSidebar
          actionEntries={actionEntries}
          activeEntryId={activeEntryId}
          activeTab={activeTab}
          data={data}
          logEntries={logEntries}
          networkEntries={networkEntries}
          networkRequests={debuggerData.networkRequests}
          onEntrySelect={handleEntrySelect}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  )
}
