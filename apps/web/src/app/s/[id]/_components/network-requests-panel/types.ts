import type { DebuggerNetworkRequest, DebuggerTimelineEntry } from "../types"

export type DetailSection = "overview" | "request" | "response"

export interface BodyPreview {
  formatted: string
  raw: string
}

export interface KeyValueItem {
  id: string
  key: string
  value: string
}

export interface NetworkRequestsPanelProps {
  bugReportId: string
  entries: DebuggerTimelineEntry[]
  requests: DebuggerNetworkRequest[]
  activeEntryId: string | null
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  onLoadMore: () => void
  onEntrySelect: (entry: DebuggerTimelineEntry) => void
}

export interface NetworkRequestDetailsProps {
  bugReportId: string
  request: DebuggerNetworkRequest | null
}
