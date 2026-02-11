"use client"

import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Button } from "@crikket/ui/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@crikket/ui/components/ui/resizable"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import Link from "next/link"
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { orpc } from "@/utils/orpc"

import { BugReportCanvas } from "./bug-report-canvas"
import { BugReportHeader } from "./bug-report-header"
import { BugReportSidebar, type SidebarTab } from "./bug-report-sidebar"
import type { DebuggerTimelineEntry } from "./types"
import {
  applyVideoOffsetFallback,
  buildActionEntry,
  buildLogEntry,
  buildNetworkEntry,
  getPlaybackEntryIds,
} from "./utils"

interface BugReportViewProps {
  id: string
}

interface SelectedEntryIds {
  action: string | null
  log: string | null
  network: string | null
}

const CANVAS_MIN_WIDTH = "720px"
const SIDEBAR_DEFAULT_WIDTH = "420px"
const SIDEBAR_MIN_WIDTH = "360px"
const SIDEBAR_MAX_WIDTH = "1080px"
const NETWORK_REQUESTS_PAGE_SIZE = 10
const SIDEBAR_TABS = [
  "details",
  "actions",
  "console",
  "network",
] as const satisfies readonly SidebarTab[]
const EMPTY_SELECTION: SelectedEntryIds = {
  action: null,
  log: null,
  network: null,
}

function getMetadataDurationMs(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const durationMs = (metadata as { durationMs?: unknown }).durationMs
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
    return null
  }

  return Math.max(0, Math.floor(durationMs))
}

export function BugReportView({ id }: BugReportViewProps) {
  const { data, isLoading, error } = useQuery(
    orpc.bugReport.getById.queryOptions({
      input: { id },
      enabled: Boolean(id),
    })
  )

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(SIDEBAR_TABS).withDefault("details")
  )
  const [networkSearch] = useQueryState("networkSearch", parseAsString)
  const [hasOpenedDebuggerTimelineTab, setHasOpenedDebuggerTimelineTab] =
    useState(false)
  const [hasOpenedNetworkTab, setHasOpenedNetworkTab] = useState(false)

  useEffect(() => {
    if (activeTab === "actions" || activeTab === "console") {
      setHasOpenedDebuggerTimelineTab(true)
    }

    if (activeTab === "network") {
      setHasOpenedNetworkTab(true)
    }
  }, [activeTab])

  const debuggerEventsQuery = useQuery(
    orpc.bugReport.getDebuggerEvents.queryOptions({
      input: { id },
      enabled: Boolean(id) && hasOpenedDebuggerTimelineTab,
    })
  )

  const networkRequestsQuery = useInfiniteQuery(
    orpc.bugReport.getNetworkRequests.infiniteOptions({
      initialPageParam: 1,
      input: (pageParam) => ({
        id,
        page: pageParam,
        perPage: NETWORK_REQUESTS_PAGE_SIZE,
        search: networkSearch ?? undefined,
      }),
      queryKey: ["networkRequests", id, networkSearch ?? ""],
      getNextPageParam: (lastPage) =>
        lastPage.pagination.hasNextPage
          ? lastPage.pagination.page + 1
          : undefined,
      enabled: Boolean(id) && hasOpenedNetworkTab,
    })
  )

  const debuggerEvents = debuggerEventsQuery.data ?? {
    actions: [],
    logs: [],
  }

  const networkRequests = useMemo(() => {
    return networkRequestsQuery.data?.pages.flatMap((page) => page.items) ?? []
  }, [networkRequestsQuery.data])

  const desktopVideoRef = useRef<HTMLVideoElement | null>(null)
  const mobileVideoRef = useRef<HTMLVideoElement | null>(null)
  const [playbackOffsetMs, setPlaybackOffsetMs] = useState(0)
  const [isMobileVideoHidden, setIsMobileVideoHidden] = useState(false)
  const [selectedEntryIds, setSelectedEntryIds] =
    useState<SelectedEntryIds>(EMPTY_SELECTION)

  const showVideo =
    data?.attachmentType === "video" && Boolean(data.attachmentUrl)
  const metadataDurationMs = getMetadataDurationMs(data?.metadata)

  const actionEntries = useMemo(
    () =>
      applyVideoOffsetFallback(
        debuggerEvents.actions.map(buildActionEntry),
        showVideo
      ),
    [debuggerEvents.actions, showVideo]
  )
  const logEntries = useMemo(
    () =>
      applyVideoOffsetFallback(
        debuggerEvents.logs.map(buildLogEntry),
        showVideo
      ),
    [debuggerEvents.logs, showVideo]
  )
  const networkEntries = useMemo(
    () =>
      applyVideoOffsetFallback(
        networkRequests.map(buildNetworkEntry),
        showVideo
      ),
    [networkRequests, showVideo]
  )

  const playbackActionEntryIds = useMemo(
    () =>
      getPlaybackEntryIds({
        showVideo: showVideo ?? false,
        playbackOffsetMs,
        entries: actionEntries,
      }),
    [actionEntries, playbackOffsetMs, showVideo]
  )
  const playbackLogEntryIds = useMemo(
    () =>
      getPlaybackEntryIds({
        showVideo: showVideo ?? false,
        playbackOffsetMs,
        entries: logEntries,
      }),
    [logEntries, playbackOffsetMs, showVideo]
  )
  const playbackNetworkEntryIds = useMemo(
    () =>
      getPlaybackEntryIds({
        showVideo: showVideo ?? false,
        playbackOffsetMs,
        entries: networkEntries,
      }),
    [networkEntries, playbackOffsetMs, showVideo]
  )

  const highlightedActionEntryIds = showVideo ? playbackActionEntryIds : []
  const highlightedLogEntryIds = showVideo ? playbackLogEntryIds : []
  const highlightedNetworkEntryIds = showVideo ? playbackNetworkEntryIds : []

  const getVisibleVideoElement = useCallback((): HTMLVideoElement | null => {
    const desktopVideo = desktopVideoRef.current
    if (desktopVideo?.offsetParent !== null) {
      return desktopVideo
    }

    const mobileVideo = mobileVideoRef.current
    if (mobileVideo?.offsetParent !== null) {
      return mobileVideo
    }

    return desktopVideo ?? mobileVideo ?? null
  }, [])

  const handleEntrySelect = (entry: DebuggerTimelineEntry) => {
    setSelectedEntryIds((current) => ({
      ...current,
      [entry.kind]: entry.id,
    }))

    if (!showVideo) {
      return
    }

    if (typeof entry.offset !== "number") {
      return
    }

    const clampedOffsetMs =
      typeof metadataDurationMs === "number"
        ? Math.min(entry.offset, metadataDurationMs)
        : entry.offset
    const targetSeconds = clampedOffsetMs / 1000
    const visiblePlayer = getVisibleVideoElement()
    const shouldResumePlayback = Boolean(visiblePlayer && !visiblePlayer.paused)
    const knownPlayers = [desktopVideoRef.current, mobileVideoRef.current]
    for (const player of knownPlayers) {
      if (!player) {
        continue
      }
      player.currentTime = targetSeconds
    }

    setPlaybackOffsetMs(clampedOffsetMs)

    if (!(visiblePlayer && shouldResumePlayback)) {
      return
    }

    visiblePlayer.play().catch((error: unknown) => {
      reportNonFatalError(
        "Failed to preserve playback after timeline seek interaction",
        error
      )
    })
  }

  const handleLoadMoreNetworkRequests = useCallback(() => {
    if (!networkRequestsQuery.hasNextPage || networkRequestsQuery.isFetching) {
      return
    }

    networkRequestsQuery
      .fetchNextPage({ cancelRefetch: false })
      .catch((error: unknown) => {
        reportNonFatalError("Failed to fetch next network requests page", error)
      })
  }, [
    networkRequestsQuery.fetchNextPage,
    networkRequestsQuery.hasNextPage,
    networkRequestsQuery.isFetching,
  ])

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab)
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
        {/* Desktop View */}
        <div className="hidden h-full w-full md:block">
          <ResizablePanelGroup
            className="h-full w-full"
            orientation="horizontal"
          >
            <ResizablePanel minSize={CANVAS_MIN_WIDTH}>
              <div className="flex h-full">
                <BugReportCanvas
                  data={data}
                  onTimeUpdate={setPlaybackOffsetMs}
                  ref={desktopVideoRef}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />

            <ResizablePanel
              defaultSize={SIDEBAR_DEFAULT_WIDTH}
              maxSize={SIDEBAR_MAX_WIDTH}
              minSize={SIDEBAR_MIN_WIDTH}
            >
              <BugReportSidebar
                actionEntries={actionEntries}
                activeTab={activeTab}
                bugReportId={data.id}
                data={data}
                hasMoreNetworkRequests={Boolean(
                  networkRequestsQuery.hasNextPage
                )}
                highlightedActionEntryIds={highlightedActionEntryIds}
                highlightedLogEntryIds={highlightedLogEntryIds}
                highlightedNetworkEntryIds={highlightedNetworkEntryIds}
                isFetchingMoreNetworkRequests={
                  networkRequestsQuery.isFetchingNextPage
                }
                isNetworkRequestsLoading={networkRequestsQuery.isLoading}
                logEntries={logEntries}
                networkEntries={networkEntries}
                networkRequests={networkRequests}
                onEntrySelect={handleEntrySelect}
                onLoadMoreNetworkRequests={handleLoadMoreNetworkRequests}
                onTabChange={handleTabChange}
                selectedActionEntryId={selectedEntryIds.action}
                selectedLogEntryId={selectedEntryIds.log}
                selectedNetworkEntryId={selectedEntryIds.network}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile View */}
        <div className="flex h-full w-full flex-col md:hidden">
          {!isMobileVideoHidden && (
            <div className="shrink-0 border-b">
              <BugReportCanvas
                compact
                data={data}
                onTimeUpdate={setPlaybackOffsetMs}
                ref={mobileVideoRef}
              />
            </div>
          )}
          <div className="min-h-0 flex-1">
            <BugReportSidebar
              actionEntries={actionEntries}
              activeTab={activeTab}
              bugReportId={data.id}
              data={data}
              hasMoreNetworkRequests={Boolean(networkRequestsQuery.hasNextPage)}
              highlightedActionEntryIds={highlightedActionEntryIds}
              highlightedLogEntryIds={highlightedLogEntryIds}
              highlightedNetworkEntryIds={highlightedNetworkEntryIds}
              isFetchingMoreNetworkRequests={
                networkRequestsQuery.isFetchingNextPage
              }
              isNetworkRequestsLoading={networkRequestsQuery.isLoading}
              logEntries={logEntries}
              networkEntries={networkEntries}
              networkRequests={networkRequests}
              onEntrySelect={handleEntrySelect}
              onLoadMoreNetworkRequests={handleLoadMoreNetworkRequests}
              onTabChange={handleTabChange}
              selectedActionEntryId={selectedEntryIds.action}
              selectedLogEntryId={selectedEntryIds.log}
              selectedNetworkEntryId={selectedEntryIds.network}
              tabAction={
                <button
                  aria-label={isMobileVideoHidden ? "Show video" : "Hide video"}
                  className="rounded-[4px] p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => {
                    setIsMobileVideoHidden((current) => !current)
                  }}
                  type="button"
                >
                  {isMobileVideoHidden ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
