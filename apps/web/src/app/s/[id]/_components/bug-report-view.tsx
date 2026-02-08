"use client"

import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Button, buttonVariants } from "@crikket/ui/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@crikket/ui/components/ui/resizable"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@crikket/ui/components/ui/sheet"
import { cn } from "@crikket/ui/lib/utils"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { AlertCircle, Loader2, Menu } from "lucide-react"
import Link from "next/link"
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
} from "./utils"

interface BugReportViewProps {
  id: string
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

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playbackOffsetMs, setPlaybackOffsetMs] = useState(0)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const showVideo =
    data?.attachmentType === "video" && Boolean(data.attachmentUrl)

  const actionEntries = useMemo(
    () => debuggerEvents.actions.map(buildActionEntry),
    [debuggerEvents.actions]
  )
  const logEntries = useMemo(
    () => debuggerEvents.logs.map(buildLogEntry),
    [debuggerEvents.logs]
  )
  const networkEntries = useMemo(
    () => networkRequests.map(buildNetworkEntry),
    [networkRequests]
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

    videoRef.current.play().catch((error: unknown) => {
      reportNonFatalError(
        "Failed to resume playback after timeline seek interaction",
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
    <Sheet>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <BugReportHeader
          data={data}
          sidebarTrigger={
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "-ml-2 h-8 w-8"
              )}
            >
              <Menu className="h-4 w-4" />
            </SheetTrigger>
          }
        />

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
                    ref={videoRef}
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
                  activeEntryId={activeEntryId}
                  activeTab={activeTab}
                  bugReportId={data.id}
                  data={data}
                  hasMoreNetworkRequests={Boolean(
                    networkRequestsQuery.hasNextPage
                  )}
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
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {/* Mobile View */}
          <div className="flex h-full w-full flex-col md:hidden">
            <BugReportCanvas
              data={data}
              onTimeUpdate={setPlaybackOffsetMs}
              ref={videoRef}
            />
          </div>
        </div>
      </div>

      <SheetContent className="w-[90%] p-0 sm:max-w-md" side="left">
        <SheetTitle className="sr-only">Bug Report Details</SheetTitle>
        <BugReportSidebar
          actionEntries={actionEntries}
          activeEntryId={activeEntryId}
          activeTab={activeTab}
          bugReportId={data.id}
          data={data}
          hasMoreNetworkRequests={Boolean(networkRequestsQuery.hasNextPage)}
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
        />
      </SheetContent>
    </Sheet>
  )
}
