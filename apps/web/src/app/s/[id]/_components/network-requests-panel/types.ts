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
  entries: DebuggerTimelineEntry[]
  requests: DebuggerNetworkRequest[]
  activeEntryId: string | null
  onEntrySelect: (entry: DebuggerTimelineEntry) => void
}

export interface NetworkRequestDetailsProps {
  request: DebuggerNetworkRequest | null
}
