"use client"

import { Input } from "@crikket/ui/components/ui/input"
import { cn } from "@crikket/ui/lib/utils"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { formatOffset } from "../utils"
import { NetworkRequestDetails } from "./network-request-details"
import { EmptyState } from "./panel-sections"
import type { NetworkRequestsPanelProps } from "./types"
import { safeParseUrl, statusTone } from "./utils"

export function NetworkRequestsPanel({
  entries,
  requests,
  activeEntryId,
  onEntrySelect,
}: NetworkRequestsPanelProps) {
  const [searchValue, setSearchValue] = useState("")

  const requestsById = useMemo(
    () =>
      new Map(
        requests.map((request) => {
          return [request.id, request] as const
        })
      ),
    [requests]
  )

  const normalizedQuery = searchValue.trim().toLowerCase()

  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) {
      return entries
    }

    return entries.filter((entry) => {
      const request = requestsById.get(entry.id)
      const methodMatches = request?.method
        .toLowerCase()
        .includes(normalizedQuery)
      const urlMatches = request?.url.toLowerCase().includes(normalizedQuery)
      const statusMatches = String(request?.status ?? "").includes(
        normalizedQuery
      )
      return methodMatches || urlMatches || statusMatches
    })
  }, [entries, normalizedQuery, requestsById])

  const selectedEntry = useMemo(() => {
    if (activeEntryId) {
      const activeMatch = filteredEntries.find(
        (entry) => entry.id === activeEntryId
      )
      if (activeMatch) {
        return activeMatch
      }
    }

    return filteredEntries[0] ?? null
  }, [activeEntryId, filteredEntries])

  const selectedRequest = selectedEntry
    ? requestsById.get(selectedEntry.id)
    : null

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
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Filter by method, URL, or status..."
            value={searchValue}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(180px,44%)_minmax(0,1fr)]">
        <div className="overflow-y-auto border-b bg-background">
          {filteredEntries.length === 0 ? (
            <EmptyState
              message={
                normalizedQuery
                  ? "No requests matched your search."
                  : "No network requests captured."
              }
            />
          ) : (
            <div className="divide-y">
              {filteredEntries.map((entry) => {
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
                      entry.id === selectedEntry?.id &&
                        "bg-muted/60 shadow-[inset_2px_0_0_0] shadow-primary"
                    )}
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
            </div>
          )}
        </div>

        <div className="overflow-y-auto bg-muted/20 p-3">
          <NetworkRequestDetails
            key={selectedEntry?.id ?? "empty"}
            request={selectedRequest ?? null}
          />
        </div>
      </div>
    </div>
  )
}
