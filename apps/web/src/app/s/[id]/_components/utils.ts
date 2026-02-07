import type { DebuggerTimelineEntry, SharedBugReportDebugger } from "./types"

const EMPTY_DEBUGGER_DATA: SharedBugReportDebugger = {
  actions: [],
  logs: [],
  networkRequests: [],
}

export function normalizeDebuggerData(value: unknown): SharedBugReportDebugger {
  if (!isRecord(value)) {
    return EMPTY_DEBUGGER_DATA
  }

  return {
    actions: Array.isArray(value.actions)
      ? value.actions.map(normalizeAction).filter(isDefined)
      : [],
    logs: Array.isArray(value.logs)
      ? value.logs.map(normalizeLog).filter(isDefined)
      : [],
    networkRequests: Array.isArray(value.networkRequests)
      ? value.networkRequests.map(normalizeNetworkRequest).filter(isDefined)
      : [],
  }
}

export function buildActionEntry(
  action: SharedBugReportDebugger["actions"][number]
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

export function buildLogEntry(
  log: SharedBugReportDebugger["logs"][number]
): DebuggerTimelineEntry {
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
  request: SharedBugReportDebugger["networkRequests"][number]
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

function normalizeAction(
  value: unknown
): SharedBugReportDebugger["actions"][number] | null {
  if (!isRecord(value)) return null

  const id = asString(value.id)
  const type = asString(value.type)
  const timestamp = asString(value.timestamp)

  if (!(id && type && timestamp)) {
    return null
  }

  return {
    id,
    type,
    target: asNullableString(value.target),
    timestamp,
    offset: asNullableNumber(value.offset),
    metadata: asUnknownRecord(value.metadata),
  }
}

function normalizeLog(
  value: unknown
): SharedBugReportDebugger["logs"][number] | null {
  if (!isRecord(value)) return null

  const id = asString(value.id)
  const level = asString(value.level)
  const message = asString(value.message)
  const timestamp = asString(value.timestamp)

  if (!(id && level && message && timestamp)) {
    return null
  }

  return {
    id,
    level,
    message,
    timestamp,
    offset: asNullableNumber(value.offset),
    metadata: asUnknownRecord(value.metadata),
  }
}

function normalizeNetworkRequest(
  value: unknown
): SharedBugReportDebugger["networkRequests"][number] | null {
  if (!isRecord(value)) return null

  const id = asString(value.id)
  const method = asString(value.method)
  const url = asString(value.url)
  const timestamp = asString(value.timestamp)

  if (!(id && method && url && timestamp)) {
    return null
  }

  return {
    id,
    method,
    url,
    status: asNullableNumber(value.status),
    duration: asNullableNumber(value.duration),
    requestHeaders: asStringRecord(value.requestHeaders),
    responseHeaders: asStringRecord(value.responseHeaders),
    requestBody: asNullableString(value.requestBody),
    responseBody: asNullableString(value.responseBody),
    timestamp,
    offset: asNullableNumber(value.offset),
  }
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
  } catch {
    return null
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  return Math.floor(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asUnknownRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function asStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null
  }

  const result: Record<string, string> = {}

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === "string") {
      result[key] = entryValue
    }
  }

  return Object.keys(result).length > 0 ? result : null
}

function isDefined<TValue>(value: TValue | null): value is TValue {
  return value !== null
}
