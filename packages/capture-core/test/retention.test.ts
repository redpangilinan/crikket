import { describe, expect, it } from "bun:test"

import { MAX_EVENT_COUNT } from "../src/debugger/constants"
import {
  appendActionEventWithDedup,
  appendEventWithRetentionPolicy,
  appendNetworkEventWithDedup,
} from "../src/debugger/engine/background/retention"
import type { DebuggerEvent } from "../src/debugger/types"

describe("debugger retention regression", () => {
  it("deduplicates adjacent network events inside the duplicate window", () => {
    const events: DebuggerEvent[] = []

    appendNetworkEventWithDedup(events, {
      kind: "network",
      timestamp: 1000,
      method: "GET",
      url: "https://example.com/api/reports",
      status: 200,
    })
    appendNetworkEventWithDedup(events, {
      kind: "network",
      timestamp: 1200,
      method: "GET",
      url: "https://example.com/api/reports",
      status: 200,
    })
    appendNetworkEventWithDedup(events, {
      kind: "network",
      timestamp: 1500,
      method: "GET",
      url: "https://example.com/api/reports",
      status: 200,
    })

    expect(events).toEqual([
      {
        kind: "network",
        timestamp: 1000,
        method: "GET",
        url: "https://example.com/api/reports",
        status: 200,
      },
      {
        kind: "network",
        timestamp: 1500,
        method: "GET",
        url: "https://example.com/api/reports",
        status: 200,
      },
    ])
  })

  it("deduplicates repeated navigation actions for the same url", () => {
    const events: DebuggerEvent[] = []

    appendActionEventWithDedup(events, {
      kind: "action",
      timestamp: 2000,
      actionType: "navigation",
      metadata: {
        url: "https://example.com/dashboard",
      },
    })
    appendActionEventWithDedup(events, {
      kind: "action",
      timestamp: 2300,
      actionType: "navigation",
      metadata: {
        url: "https://example.com/dashboard",
      },
    })
    appendActionEventWithDedup(events, {
      kind: "action",
      timestamp: 2600,
      actionType: "navigation",
      metadata: {
        url: "https://example.com/settings",
      },
    })

    expect(events).toEqual([
      {
        kind: "action",
        timestamp: 2000,
        actionType: "navigation",
        metadata: {
          url: "https://example.com/dashboard",
        },
      },
      {
        kind: "action",
        timestamp: 2600,
        actionType: "navigation",
        metadata: {
          url: "https://example.com/settings",
        },
      },
    ])
  })

  it("enforces the global event cap by dropping oldest low-priority events first", () => {
    const events: DebuggerEvent[] = []

    for (let index = 0; index < MAX_EVENT_COUNT; index += 1) {
      appendEventWithRetentionPolicy(events, {
        kind: "console",
        timestamp: index,
        level: "info",
        message: `console-${index}`,
      })
    }

    appendEventWithRetentionPolicy(events, {
      kind: "network",
      timestamp: MAX_EVENT_COUNT + 1,
      method: "POST",
      url: "https://example.com/api/report",
      status: 201,
    })

    expect(events).toHaveLength(801)
    expect(events.some((event) => event.kind === "network")).toBe(true)
    expect(events[0]).toEqual({
      kind: "console",
      timestamp: 1200,
      level: "info",
      message: "console-1200",
    })
  })
})
