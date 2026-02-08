import { reportNonFatalError } from "@crikket/shared/lib/errors"
import type {
  DebuggerAction,
  DebuggerLog,
  DebuggerNetworkRequest,
  DebuggerTimelineEntry,
} from "./types"

export function buildActionEntry(
  action: DebuggerAction
): DebuggerTimelineEntry {
  const detailBits = [
    action.target ?? "unknown target",
    asString(action.metadata?.mode),
  ].filter(Boolean)

  return {
    id: action.id,
    kind: "action",
    label: action.type,
    detail: detailBits.join(" • "),
    timestamp: action.timestamp,
    offset: action.offset,
  }
}

export function buildLogEntry(log: DebuggerLog): DebuggerTimelineEntry {
  return {
    id: log.id,
    kind: "log",
    label: log.level.toUpperCase(),
    detail: log.message,
    timestamp: log.timestamp,
    offset: log.offset,
  }
}

export function buildNetworkEntry(
  request: DebuggerNetworkRequest
): DebuggerTimelineEntry {
  const parsedUrl = safeParseUrl(request.url)
  const path = parsedUrl
    ? `${parsedUrl.pathname}${parsedUrl.search}`
    : request.url

  const statusLabel = request.status ?? "pending"
  const durationLabel =
    typeof request.duration === "number" ? `${request.duration}ms` : null

  const detail = [path, `status:${statusLabel}`, durationLabel]
    .filter(Boolean)
    .join(" • ")

  return {
    id: request.id,
    kind: "network",
    label: request.method.toUpperCase(),
    detail,
    timestamp: request.timestamp,
    offset: request.offset,
  }
}

export function getPlaybackEntryId(input: {
  showVideo: boolean
  playbackOffsetMs: number
  entries: DebuggerTimelineEntry[]
}): string | null {
  if (!input.showVideo) {
    return null
  }

  const timeline = input.entries
    .filter(
      (entry): entry is DebuggerTimelineEntry & { offset: number } =>
        typeof entry.offset === "number"
    )
    .sort((a, b) => a.offset - b.offset)

  let current: string | null = null

  for (const entry of timeline) {
    if (entry.offset <= input.playbackOffsetMs) {
      current = entry.id
    }
  }

  return current
}

export function formatEventTimeLabel(entry: DebuggerTimelineEntry): string {
  const offsetLabel =
    typeof entry.offset === "number"
      ? `Video ${formatOffset(entry.offset)}`
      : "Outside recording"

  const absoluteTime = new Date(entry.timestamp).toLocaleTimeString()
  return `${offsetLabel} • ${absoluteTime}`
}

export function formatOffset(offsetMs: number): string {
  const safeOffset = Math.max(0, Math.floor(offsetMs))
  const totalSeconds = Math.floor(safeOffset / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const milliseconds = Math.floor((safeOffset % 1000) / 100)

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds}`
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch (error) {
    reportNonFatalError(
      "Failed to parse debugger network URL",
      { error, value },
      {
        once: true,
      }
    )
    return null
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}
