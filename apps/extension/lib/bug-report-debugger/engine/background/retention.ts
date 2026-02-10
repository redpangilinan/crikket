import { MAX_EVENT_COUNT } from "../../constants"
import type { DebuggerEvent } from "../../types"

const MAX_ACTION_EVENT_COUNT = 400
const MAX_CONSOLE_EVENT_COUNT = 800
const MAX_NETWORK_EVENT_COUNT = 1200

export function appendEventWithRetentionPolicy(
  events: DebuggerEvent[],
  event: DebuggerEvent
): void {
  events.push(event)

  enforceKindCap(events, event.kind)

  while (events.length > MAX_EVENT_COUNT) {
    const dropIndex = findOldestEventIndexByPriority(events, [
      "console",
      "action",
      "network",
    ])

    events.splice(dropIndex, 1)
  }
}

export function appendNetworkEventWithDedup(
  events: DebuggerEvent[],
  event: Extract<DebuggerEvent, { kind: "network" }>
): void {
  if (isLikelyDuplicateNetworkEvent(events, event)) {
    return
  }

  appendEventWithRetentionPolicy(events, event)
}

export function appendActionEventWithDedup(
  events: DebuggerEvent[],
  event: Extract<DebuggerEvent, { kind: "action" }>
): void {
  if (isLikelyDuplicateNavigationEvent(events, event)) {
    return
  }

  appendEventWithRetentionPolicy(events, event)
}

function isLikelyDuplicateNetworkEvent(
  events: DebuggerEvent[],
  candidate: Extract<DebuggerEvent, { kind: "network" }>
): boolean {
  const DUPLICATE_WINDOW_MS = 350

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!event || event.kind !== "network") {
      continue
    }

    const isSameKey =
      event.method === candidate.method &&
      event.url === candidate.url &&
      (event.status ?? 0) === (candidate.status ?? 0)

    if (!isSameKey) {
      continue
    }

    const delta = Math.abs(event.timestamp - candidate.timestamp)
    if (delta > DUPLICATE_WINDOW_MS) {
      return false
    }

    return true
  }

  return false
}

function isLikelyDuplicateNavigationEvent(
  events: DebuggerEvent[],
  candidate: Extract<DebuggerEvent, { kind: "action" }>
): boolean {
  if (candidate.actionType !== "navigation") {
    return false
  }

  const DUPLICATE_WINDOW_MS = 500
  const candidateUrl = getNavigationUrl(candidate)
  if (!candidateUrl) {
    return false
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (
      !event ||
      event.kind !== "action" ||
      event.actionType !== "navigation"
    ) {
      continue
    }

    const delta = Math.abs(event.timestamp - candidate.timestamp)
    if (delta > DUPLICATE_WINDOW_MS) {
      return false
    }

    const previousUrl = getNavigationUrl(event)
    if (previousUrl === candidateUrl) {
      return true
    }
  }

  return false
}

function getNavigationUrl(
  event: Extract<DebuggerEvent, { kind: "action" }>
): string | null {
  const metadata = event.metadata
  if (!(metadata && typeof metadata === "object")) {
    return null
  }

  const url = metadata.url
  return typeof url === "string" && url.length > 0 ? url : null
}

function enforceKindCap(
  events: DebuggerEvent[],
  kind: DebuggerEvent["kind"]
): void {
  const maxPerKind = getMaxPerKind(kind)
  let count = 0

  for (const event of events) {
    if (event.kind === kind) {
      count += 1
    }
  }

  const overflowCount = count - maxPerKind
  if (overflowCount <= 0) {
    return
  }

  let removed = 0
  for (
    let index = 0;
    index < events.length && removed < overflowCount;
    index += 1
  ) {
    if (events[index]?.kind !== kind) {
      continue
    }

    events.splice(index, 1)
    index -= 1
    removed += 1
  }
}

function getMaxPerKind(kind: DebuggerEvent["kind"]): number {
  if (kind === "action") {
    return MAX_ACTION_EVENT_COUNT
  }

  if (kind === "console") {
    return MAX_CONSOLE_EVENT_COUNT
  }

  return MAX_NETWORK_EVENT_COUNT
}

function findOldestEventIndexByPriority(
  events: DebuggerEvent[],
  priority: DebuggerEvent["kind"][]
): number {
  for (const kind of priority) {
    const index = events.findIndex((event) => event.kind === kind)
    if (index >= 0) {
      return index
    }
  }

  return 0
}
