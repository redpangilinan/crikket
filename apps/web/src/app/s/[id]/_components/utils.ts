import { reportNonFatalError } from "@crikket/shared/lib/errors"
import type {
  DebuggerAction,
  DebuggerLog,
  DebuggerNetworkRequest,
  DebuggerTimelineEntry,
} from "./types"

const PLAYBACK_HIGHLIGHT_BUCKET_MS = 100

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

export function applyVideoOffsetFallback(
  entries: DebuggerTimelineEntry[],
  enabled: boolean
): DebuggerTimelineEntry[] {
  if (!enabled) {
    return entries
  }

  return entries.map((entry) => {
    if (typeof entry.offset === "number") {
      return entry
    }

    return {
      ...entry,
      offset: 0,
    }
  })
}

export function getPlaybackEntryIds(input: {
  showVideo: boolean
  playbackOffsetMs: number
  entries: DebuggerTimelineEntry[]
}): string[] {
  if (!input.showVideo) {
    return []
  }

  const timeline = input.entries
    .filter(
      (entry): entry is DebuggerTimelineEntry & { offset: number } =>
        typeof entry.offset === "number"
    )
    .sort((a, b) => a.offset - b.offset)

  let activeOffsetBucket: number | null = null

  for (const entry of timeline) {
    if (entry.offset <= input.playbackOffsetMs) {
      activeOffsetBucket = getOffsetBucket(entry.offset)
    }
  }

  if (activeOffsetBucket === null) {
    return []
  }

  return timeline
    .filter((entry) => getOffsetBucket(entry.offset) === activeOffsetBucket)
    .map((entry) => entry.id)
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

function getOffsetBucket(offsetMs: number): number {
  return Math.floor(Math.max(0, offsetMs) / PLAYBACK_HIGHLIGHT_BUCKET_MS)
}
