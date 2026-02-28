import { describe, expect, it } from "bun:test"

import {
  buildDebuggerSubmissionPayload,
  hasDebuggerPayloadData,
} from "../src/debugger/payload"
import type { DebuggerSessionSnapshot } from "../src/debugger/types"

describe("debugger payload regression", () => {
  it("sorts events and computes offsets from recording start when available", () => {
    const snapshot: DebuggerSessionSnapshot = {
      sessionId: "session_1",
      captureTabId: 12,
      captureType: "video",
      startedAt: 1000,
      recordingStartedAt: 1500,
      events: [
        {
          kind: "network",
          timestamp: 2100,
          method: "POST",
          url: "https://example.com/api/report",
          status: 201,
        },
        {
          kind: "action",
          timestamp: 1200,
          actionType: "click",
          target: "button.submit",
          metadata: {
            source: "checkout",
          },
        },
        {
          kind: "console",
          timestamp: 1800,
          level: "error",
          message: "Network failed",
          metadata: {
            attempts: 2,
          },
        },
      ],
    }

    const payload = buildDebuggerSubmissionPayload(snapshot)

    expect(payload).toEqual({
      actions: [
        {
          type: "click",
          target: "button.submit",
          timestamp: new Date(1200).toISOString(),
          offset: null,
          metadata: {
            source: "checkout",
          },
        },
      ],
      logs: [
        {
          level: "error",
          message: "Network failed",
          timestamp: new Date(1800).toISOString(),
          offset: 300,
          metadata: {
            attempts: 2,
          },
        },
      ],
      networkRequests: [
        {
          method: "POST",
          url: "https://example.com/api/report",
          status: 201,
          duration: undefined,
          requestHeaders: undefined,
          responseHeaders: undefined,
          requestBody: undefined,
          responseBody: undefined,
          timestamp: new Date(2100).toISOString(),
          offset: 600,
        },
      ],
    })
  })

  it("detects whether a payload contains any debugger data", () => {
    expect(
      hasDebuggerPayloadData({
        actions: [],
        logs: [],
        networkRequests: [],
      })
    ).toBe(false)

    expect(
      hasDebuggerPayloadData({
        actions: [
          {
            type: "click",
            timestamp: new Date(1000).toISOString(),
            offset: 0,
          },
        ],
        logs: [],
        networkRequests: [],
      })
    ).toBe(true)
  })
})
