"use client"

import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Input } from "@crikket/ui/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@crikket/ui/components/ui/resizable"
import { useDebounce } from "@crikket/ui/hooks/use-debounce"
import { cn } from "@crikket/ui/lib/utils"
import { Search } from "lucide-react"
import { parseAsString, useQueryState } from "nuqs"
import { useEffect, useMemo, useRef, useState } from "react"

import { formatOffset } from "../utils"
import { NetworkRequestDetails } from "./network-request-details"
import { EmptyState } from "./panel-sections"
import type { NetworkRequestsPanelProps } from "./types"
import { safeParseUrl, statusTone } from "./utils"

const REQUEST_LIST_DEFAULT_HEIGHT = "300px"
const REQUEST_LIST_MIN_HEIGHT = "190px"
const DETAILS_MIN_HEIGHT = "220px"

export function NetworkRequestsPanel({
  bugReportId,
  entries,
  requests,
  selectedEntryId,
  highlightedEntryIds,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onEntrySelect,
}: NetworkRequestsPanelProps) {
  const [searchParamValue, setSearchParamValue] = useQueryState(
    "networkSearch",
    parseAsString
  )
  const [searchInputValue, setSearchInputValue] = useState(
    searchParamValue ?? ""
  )
  const debouncedSearchValue = useDebounce(searchInputValue)
  const lastSyncedSearchParamRef = useRef<string | null>(
    (searchParamValue ?? "").trim() || null
  )
  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const requestsById = useMemo(
    () =>
      new Map(
        requests.map((request) => {
          return [request.id, request] as const
        })
      ),
    [requests]
  )

  const normalizedQuery = (searchParamValue ?? "").trim().toLowerCase()

  useEffect(() => {
    const normalizedSearchParamValue = (searchParamValue ?? "").trim() || null
    if (normalizedSearchParamValue === lastSyncedSearchParamRef.current) {
      return
    }

    lastSyncedSearchParamRef.current = normalizedSearchParamValue
    setSearchInputValue(searchParamValue ?? "")
  }, [searchParamValue])

  useEffect(() => {
    const normalizedDebouncedValue = debouncedSearchValue.trim()
    const nextSearchParamValue =
      normalizedDebouncedValue.length > 0 ? normalizedDebouncedValue : null

    if (nextSearchParamValue === lastSyncedSearchParamRef.current) {
      return
    }

    lastSyncedSearchParamRef.current = nextSearchParamValue
    setSearchParamValue(nextSearchParamValue, { history: "replace" }).catch(
      (error: unknown) => {
        reportNonFatalError(
          "Failed to sync network search query state from panel input",
          error
        )
      }
    )
  }, [debouncedSearchValue, setSearchParamValue])

  const highlightedEntryIdSet = useMemo(
    () => new Set(highlightedEntryIds),
    [highlightedEntryIds]
  )

  const selectedEntry = useMemo(() => {
    if (selectedEntryId) {
      const selectedMatch = entries.find(
        (entry) => entry.id === selectedEntryId
      )
      if (selectedMatch) {
        return selectedMatch
      }
    }

    return entries[0] ?? null
  }, [entries, selectedEntryId])

  const selectedRequest = selectedEntry
    ? requestsById.get(selectedEntry.id)
    : null
  let emptyStateMessage = "No network requests captured."
  if (isLoading) {
    emptyStateMessage = "Loading network requests..."
  } else if (normalizedQuery) {
    emptyStateMessage = "No requests matched your search."
  }

  useEffect(() => {
    const sentinel = loadMoreRef.current
    const listContainer = listContainerRef.current

    if (!(sentinel && listContainer && hasNextPage) || isFetchingNextPage) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          onLoadMore()
        }
      },
      {
        root: listContainer,
        rootMargin: "120px 0px",
      }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  useEffect(() => {
    if (!(selectedEntryId && listContainerRef.current)) {
      return
    }

    const escapedSelectedId = CSS.escape(selectedEntryId)
    const selectedRow = listContainerRef.current.querySelector<HTMLElement>(
      `[data-entry-id="${escapedSelectedId}"]`
    )

    selectedRow?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })
  }, [selectedEntryId])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b bg-background p-3">
        <div className="flex items-center justify-between">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Captured Requests
          </p>
          <span className="rounded-full border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {entries.length}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-7 text-xs"
            onChange={(event) => {
              setSearchInputValue(event.target.value)
            }}
            placeholder="Filter by method, URL, or status..."
            value={searchInputValue}
          />
        </div>
      </div>

      <ResizablePanelGroup className="min-h-0 flex-1" orientation="vertical">
        <ResizablePanel
          defaultSize={REQUEST_LIST_DEFAULT_HEIGHT}
          minSize={REQUEST_LIST_MIN_HEIGHT}
        >
          <div
            className="h-full overflow-y-auto border-b bg-background"
            ref={listContainerRef}
          >
            {entries.length === 0 ? (
              <EmptyState message={emptyStateMessage} />
            ) : (
              <div className="divide-y">
                {entries.map((entry) => {
                  const request = requestsById.get(entry.id)
                  const status = request?.status ?? null
                  const duration = request?.duration ?? null
                  const parsed = safeParseUrl(request?.url)
                  const primaryText = parsed
                    ? `${parsed.pathname}${parsed.search}`
                    : (request?.url ?? entry.detail)

                  return (
                    <button
                      className={cn(
                        "flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none",
                        highlightedEntryIdSet.has(entry.id) &&
                          "bg-muted/30 shadow-[inset_2px_0_0_0] shadow-primary/50",
                        entry.id === selectedEntry?.id &&
                          "bg-muted/60 shadow-[inset_2px_0_0_0] shadow-primary"
                      )}
                      data-entry-id={entry.id}
                      key={entry.id}
                      onClick={() => onEntrySelect(entry)}
                      type="button"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                          {(request?.method ?? entry.label).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                          {primaryText}
                        </span>
                        {status !== null && (
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 font-mono text-[10px]",
                              statusTone(status)
                            )}
                          >
                            {status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {parsed?.host ?? "Unknown host"}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                          {typeof duration === "number" && (
                            <span>{duration}ms</span>
                          )}
                          {typeof entry.offset === "number" && (
                            <span>{formatOffset(entry.offset)}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
                {(hasNextPage || isFetchingNextPage) && (
                  <div className="flex justify-center border-t p-3">
                    <div className="w-full">
                      <div className="h-2 w-full" ref={loadMoreRef} />
                      <p className="text-center font-mono text-[10px] text-muted-foreground">
                        {isFetchingNextPage
                          ? "Loading more requests..."
                          : "Scroll for more requests"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        <ResizablePanel minSize={DETAILS_MIN_HEIGHT}>
          <div className="h-full overflow-y-auto bg-muted/20 p-3">
            <NetworkRequestDetails
              bugReportId={bugReportId}
              key={selectedEntry?.id ?? "empty"}
              request={selectedRequest ?? null}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
