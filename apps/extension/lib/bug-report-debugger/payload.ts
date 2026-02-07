import type { BugReportDebuggerPayload, DebuggerSessionSnapshot } from "./types"

export function hasDebuggerPayloadData(
  payload: BugReportDebuggerPayload
): boolean {
  return (
    payload.actions.length > 0 ||
    payload.logs.length > 0 ||
    payload.networkRequests.length > 0
  )
}

export function buildDebuggerSubmissionPayload(
  snapshot: DebuggerSessionSnapshot
): BugReportDebuggerPayload {
  const anchorTimestamp = snapshot.recordingStartedAt ?? snapshot.startedAt
  const events = [...snapshot.events].sort((a, b) => a.timestamp - b.timestamp)

  const payload: BugReportDebuggerPayload = {
    actions: [],
    logs: [],
    networkRequests: [],
  }

  for (const event of events) {
    const timestamp = new Date(event.timestamp).toISOString()
    const offset = toOffset(event.timestamp, anchorTimestamp)

    if (event.kind === "action") {
      payload.actions.push({
        type: event.actionType,
        target: event.target,
        timestamp,
        offset,
        metadata: event.metadata,
      })
      continue
    }

    if (event.kind === "console") {
      payload.logs.push({
        level: event.level,
        message: event.message,
        timestamp,
        offset,
        metadata: event.metadata,
      })
      continue
    }

    payload.networkRequests.push({
      method: event.method,
      url: event.url,
      status: event.status,
      duration: event.duration,
      requestHeaders: event.requestHeaders,
      responseHeaders: event.responseHeaders,
      requestBody: event.requestBody,
      responseBody: event.responseBody,
      timestamp,
      offset,
    })
  }

  return payload
}

function toOffset(
  eventTimestamp: number,
  anchorTimestamp: number
): number | null {
  const rawOffset = Math.floor(eventTimestamp - anchorTimestamp)
  return rawOffset >= 0 ? rawOffset : null
}
