"use client"

import {
  BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS,
  BUG_REPORT_SUBMISSION_STATUS_OPTIONS,
} from "@crikket/shared/constants/bug-report"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Button } from "@crikket/ui/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@crikket/ui/components/ui/resizable"
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query"
import { AlertCircle, Edit, Eye, EyeOff, Loader2 } from "lucide-react"
import Link from "next/link"
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"
import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { EditBugReportSheet } from "@/components/bug-reports/edit-bug-report-sheet"
import { client, orpc } from "@/utils/orpc"

import { BugReportCanvas } from "./bug-report-canvas"
import { BugReportHeader } from "./bug-report-header"
import { BugReportSidebar, type SidebarTab } from "./bug-report-sidebar"
import type { DebuggerTimelineEntry, SharedBugReport } from "./types"
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

function formatSubmissionStatusLabel(status: string): string {
  switch (status) {
    case BUG_REPORT_SUBMISSION_STATUS_OPTIONS.processing:
      return "Processing uploaded artifacts"
    case BUG_REPORT_SUBMISSION_STATUS_OPTIONS.failed:
      return "Report processing failed"
    default:
      return "Report ready"
  }
}

function formatDebuggerIngestionStatusLabel(status: string): string {
  switch (status) {
    case BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.notUploaded:
      return "Not uploaded"
    case BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.pending:
      return "Pending"
    case BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.processing:
      return "Processing"
    case BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.failed:
      return "Failed"
    default:
      return "Completed"
  }
}

function renderBugReportLoadingState() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function renderBugReportMissingState() {
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

function syncPlaybackToEntry(input: {
  desktopVideo: HTMLVideoElement | null
  entry: DebuggerTimelineEntry
  getVisibleVideoElement: () => HTMLVideoElement | null
  metadataDurationMs: number | null
  mobileVideo: HTMLVideoElement | null
  setPlaybackOffsetMs: (value: number) => void
  showVideo: boolean
}): void {
  if (!input.showVideo || typeof input.entry.offset !== "number") {
    return
  }

  const clampedOffsetMs =
    typeof input.metadataDurationMs === "number"
      ? Math.min(input.entry.offset, input.metadataDurationMs)
      : input.entry.offset
  const targetSeconds = clampedOffsetMs / 1000
  const visiblePlayer = input.getVisibleVideoElement()
  const shouldResumePlayback = Boolean(visiblePlayer && !visiblePlayer.paused)

  for (const player of [input.desktopVideo, input.mobileVideo]) {
    if (!player) {
      continue
    }
    player.currentTime = targetSeconds
  }

  input.setPlaybackOffsetMs(clampedOffsetMs)

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

function loadMoreNetworkRequests(input: {
  fetchNextPage: (options: { cancelRefetch: boolean }) => Promise<unknown>
  hasNextPage: boolean | undefined
  isFetching: boolean
}): void {
  if (!input.hasNextPage || input.isFetching) {
    return
  }

  input.fetchNextPage({ cancelRefetch: false }).catch((error: unknown) => {
    reportNonFatalError("Failed to fetch next network requests page", error)
  })
}

function handleSidebarTabChange(input: {
  setActiveTab: (
    value: SidebarTab,
    options: { shallow: boolean }
  ) => Promise<unknown>
  setHasOpenedDebuggerTimelineTab: (value: boolean) => void
  setHasOpenedNetworkTab: (value: boolean) => void
  tab: SidebarTab
}): void {
  if (input.tab === "actions" || input.tab === "console") {
    input.setHasOpenedDebuggerTimelineTab(true)
  }

  if (input.tab === "network") {
    input.setHasOpenedNetworkTab(true)
  }

  input.setActiveTab(input.tab, { shallow: false }).catch((error: unknown) => {
    reportNonFatalError("Failed to sync sidebar tab state to URL", error)
  })
}

function BugReportInternalStatusBanner(input: {
  debuggerIngestionError: string | null
  debuggerIngestionStatus: string
  isRetrying: boolean
  onRetry: () => void
  submissionStatus: string
}) {
  return (
    <div className="border-amber-200 border-b bg-amber-50 px-4 py-3 text-amber-950 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">
            {formatSubmissionStatusLabel(input.submissionStatus)}
          </p>
          <p className="text-xs">
            Debugger ingestion:{" "}
            {formatDebuggerIngestionStatusLabel(input.debuggerIngestionStatus)}
          </p>
          {input.debuggerIngestionError ? (
            <p className="text-xs">{input.debuggerIngestionError}</p>
          ) : null}
        </div>
        {input.debuggerIngestionStatus ===
        BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.failed ? (
          <Button
            disabled={input.isRetrying}
            onClick={input.onRetry}
            size="sm"
            variant="outline"
          >
            {input.isRetrying ? <Loader2 className="animate-spin" /> : null}
            Retry debugger ingest
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function renderBugReportLoadedView(input: {
  data: SharedBugReport
  isEditSheetOpen: boolean
  isMobileVideoHidden: boolean
  isReady: boolean
  onRetryDebuggerIngestion: () => void
  onTimeUpdate: (value: number) => void
  onToggleMobileVideoVisibility: () => void
  onToggleEditSheet: (value: boolean) => void
  refetch: () => Promise<unknown>
  retryIngestionPending: boolean
  sidebarProps: React.ComponentProps<typeof BugReportSidebar>
  desktopVideoRef: React.RefObject<HTMLVideoElement | null>
  mobileVideoRef: React.RefObject<HTMLVideoElement | null>
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <BugReportHeader
        data={input.data}
        editAction={
          input.data.canEdit ? (
            <Button
              onClick={() => input.onToggleEditSheet(true)}
              size="sm"
              variant="ghost"
            >
              <Edit />
              <span className="sr-only">Edit</span>
            </Button>
          ) : null
        }
      />
      {input.data.canEdit ? (
        <EditBugReportSheet
          onOpenChange={input.onToggleEditSheet}
          onUpdated={async () => {
            await input.refetch()
          }}
          open={input.isEditSheetOpen}
          report={{
            id: input.data.id,
            assigneeId: input.data.assigneeId,
            title: input.data.title,
            tags: input.data.tags,
            status: input.data.status,
            priority: input.data.priority,
            visibility: input.data.visibility,
          }}
        />
      ) : null}

      {input.data.canEdit && !input.isReady ? (
        <BugReportInternalStatusBanner
          debuggerIngestionError={input.data.debuggerIngestionError}
          debuggerIngestionStatus={input.data.debuggerIngestionStatus}
          isRetrying={input.retryIngestionPending}
          onRetry={input.onRetryDebuggerIngestion}
          submissionStatus={input.data.submissionStatus}
        />
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden h-full w-full md:block">
          <ResizablePanelGroup
            className="h-full w-full"
            orientation="horizontal"
          >
            <ResizablePanel minSize={CANVAS_MIN_WIDTH}>
              <div className="flex h-full">
                <BugReportCanvas
                  data={input.data}
                  onTimeUpdate={input.onTimeUpdate}
                  ref={input.desktopVideoRef}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />

            <ResizablePanel
              defaultSize={SIDEBAR_DEFAULT_WIDTH}
              maxSize={SIDEBAR_MAX_WIDTH}
              minSize={SIDEBAR_MIN_WIDTH}
            >
              <BugReportSidebar {...input.sidebarProps} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <div className="flex h-full w-full flex-col md:hidden">
          {input.isMobileVideoHidden ? null : (
            <div className="shrink-0 border-b">
              <BugReportCanvas
                compact
                data={input.data}
                onTimeUpdate={input.onTimeUpdate}
                ref={input.mobileVideoRef}
              />
            </div>
          )}
          <div className="min-h-0 flex-1">
            <BugReportSidebar
              {...input.sidebarProps}
              tabAction={
                <button
                  aria-label={
                    input.isMobileVideoHidden ? "Show video" : "Hide video"
                  }
                  className="rounded-[4px] p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={input.onToggleMobileVideoVisibility}
                  type="button"
                >
                  {input.isMobileVideoHidden ? (
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

export function BugReportView({ id }: BugReportViewProps) {
  const { data, isLoading, error, refetch } = useQuery(
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

  const shouldOpenDebuggerTimelineTabByDefault =
    activeTab === "actions" || activeTab === "console"
  const shouldOpenNetworkTabByDefault = activeTab === "network"
  const [hasOpenedDebuggerTimelineTab, setHasOpenedDebuggerTimelineTab] =
    useState(shouldOpenDebuggerTimelineTabByDefault)
  const [hasOpenedNetworkTab, setHasOpenedNetworkTab] = useState(
    shouldOpenNetworkTabByDefault
  )
  const shouldLoadDebuggerEvents =
    hasOpenedDebuggerTimelineTab || shouldOpenDebuggerTimelineTabByDefault
  const shouldLoadNetworkRequests =
    hasOpenedNetworkTab || shouldOpenNetworkTabByDefault

  const debuggerEventsQuery = useQuery(
    orpc.bugReport.getDebuggerEvents.queryOptions({
      input: { id },
      enabled: Boolean(id) && shouldLoadDebuggerEvents,
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
      enabled: Boolean(id) && shouldLoadNetworkRequests,
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
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [selectedEntryIds, setSelectedEntryIds] =
    useState<SelectedEntryIds>(EMPTY_SELECTION)
  const retryIngestionMutation = useMutation({
    mutationFn: async () => client.bugReport.retryDebuggerIngestion({ id }),
    onSuccess: async () => {
      await refetch()
      toast.success("Debugger ingestion retried")
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || "Failed to retry debugger ingestion")
    },
  })

  const showVideo =
    data?.attachmentType === "video" && Boolean(data.attachmentUrl)
  const metadataDurationMs = getMetadataDurationMs(data?.metadata)
  const isReady =
    data?.submissionStatus === BUG_REPORT_SUBMISSION_STATUS_OPTIONS.ready

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

    syncPlaybackToEntry({
      desktopVideo: desktopVideoRef.current,
      entry,
      getVisibleVideoElement,
      metadataDurationMs,
      mobileVideo: mobileVideoRef.current,
      setPlaybackOffsetMs,
      showVideo: Boolean(showVideo),
    })
  }

  const handleLoadMoreNetworkRequests = () => {
    loadMoreNetworkRequests({
      fetchNextPage: networkRequestsQuery.fetchNextPage,
      hasNextPage: networkRequestsQuery.hasNextPage,
      isFetching: networkRequestsQuery.isFetching,
    })
  }

  const handleTabChange = (tab: SidebarTab) => {
    handleSidebarTabChange({
      setActiveTab,
      setHasOpenedDebuggerTimelineTab,
      setHasOpenedNetworkTab,
      tab,
    })
  }

  if (isLoading) {
    return renderBugReportLoadingState()
  }

  if (error || !data) {
    return renderBugReportMissingState()
  }

  const sidebarProps = {
    bugReportId: data.id,
    data,
    activeTab,
    onTabChange: handleTabChange,
    timeline: {
      actions: {
        actions: debuggerEvents.actions,
        entries: actionEntries,
        selectedEntryId: selectedEntryIds.action,
        highlightedEntryIds: highlightedActionEntryIds,
      },
      console: {
        entries: logEntries,
        selectedEntryId: selectedEntryIds.log,
        highlightedEntryIds: highlightedLogEntryIds,
      },
    },
    network: {
      entries: networkEntries,
      requests: networkRequests,
      isLoading: networkRequestsQuery.isLoading,
      isFetchingNextPage: networkRequestsQuery.isFetchingNextPage,
      hasNextPage: Boolean(networkRequestsQuery.hasNextPage),
      onLoadMore: handleLoadMoreNetworkRequests,
      selectedEntryId: selectedEntryIds.network,
      highlightedEntryIds: highlightedNetworkEntryIds,
    },
    onEntrySelect: handleEntrySelect,
  } as const

  return renderBugReportLoadedView({
    data,
    desktopVideoRef,
    isEditSheetOpen,
    isMobileVideoHidden,
    isReady: Boolean(isReady),
    mobileVideoRef,
    onRetryDebuggerIngestion: () => retryIngestionMutation.mutate(),
    onTimeUpdate: setPlaybackOffsetMs,
    onToggleEditSheet: setIsEditSheetOpen,
    onToggleMobileVideoVisibility: () => {
      setIsMobileVideoHidden((current) => !current)
    },
    refetch,
    retryIngestionPending: retryIngestionMutation.isPending,
    sidebarProps,
  })
}
