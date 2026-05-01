import { beforeEach, describe, expect, it } from "bun:test"

if (typeof sessionStorage === "undefined") {
  const store: Record<string, string> = {}
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k]
      },
    },
  })
}

import {
  clearPersistedSession,
  loadPersistedSession,
  persistSession,
} from "../src/debugger/session-storage"
import type { DebuggerSession } from "../src/types"

const STORAGE_KEY = "__crikketActiveSession"

const sampleSession: DebuggerSession = {
  sessionId: "sess-abc-123",
  captureType: "video",
  startedAt: 1_700_000_000_000,
  recordingStartedAt: 1_700_000_001_000,
  events: [
    {
      kind: "action",
      timestamp: 1_700_000_001_500,
      actionType: "click",
      target: "button#submit",
    },
    {
      kind: "console",
      timestamp: 1_700_000_002_000,
      level: "error",
      message: "Something went wrong",
    },
  ],
}

beforeEach(() => {
  sessionStorage.clear()
})

describe("session-storage helpers", () => {
  it("round-trip: persist then load returns the same data", () => {
    persistSession(sampleSession)
    const restored = loadPersistedSession()

    expect(restored).not.toBeNull()
    expect(restored?.sessionId).toBe(sampleSession.sessionId)
    expect(restored?.captureType).toBe(sampleSession.captureType)
    expect(restored?.startedAt).toBe(sampleSession.startedAt)
    expect(restored?.recordingStartedAt).toBe(sampleSession.recordingStartedAt)
    expect(restored?.events).toHaveLength(sampleSession.events.length)
    expect(restored?.events[0]).toMatchObject({
      kind: "action",
      actionType: "click",
      target: "button#submit",
    })
    expect(restored?.events[1]).toMatchObject({
      kind: "console",
      level: "error",
      message: "Something went wrong",
    })
  })

  it("returns null when nothing is stored", () => {
    const result = loadPersistedSession()
    expect(result).toBeNull()
  })

  it("returns null and clears storage for an expired session", () => {
    const expired = {
      version: 1,
      sessionId: "sess-old",
      captureType: "video",
      startedAt: 1_700_000_000_000,
      recordingStartedAt: null,
      events: [],
      savedAt: Date.now() - 6 * 60 * 1000, // 6 minutes ago
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(expired))

    const result = loadPersistedSession()
    expect(result).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("returns null for malformed JSON", () => {
    sessionStorage.setItem(STORAGE_KEY, "not valid json {{{")
    const result = loadPersistedSession()
    expect(result).toBeNull()
  })

  it("returns null for wrong version number", () => {
    const wrongVersion = {
      version: 99,
      sessionId: "sess-xyz",
      captureType: "video",
      startedAt: 1_700_000_000_000,
      recordingStartedAt: null,
      events: [],
      savedAt: Date.now(),
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(wrongVersion))

    const result = loadPersistedSession()
    expect(result).toBeNull()
  })

  it("drops invalid events silently", () => {
    const sessionWithBadEvent: DebuggerSession = {
      ...sampleSession,
      events: [
        {
          kind: "action",
          timestamp: 1_700_000_001_500,
          actionType: "click",
        },
      ],
    }

    persistSession(sessionWithBadEvent)

    // Manually inject a bad event into the stored JSON
    const raw = sessionStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    parsed.events.push({ kind: "INVALID" })
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))

    const restored = loadPersistedSession()
    expect(restored).not.toBeNull()
    expect(restored?.events).toHaveLength(1)
    expect(restored?.events[0]).toMatchObject({ kind: "action" })
  })

  it("clearPersistedSession removes the stored item", () => {
    persistSession(sampleSession)
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull()

    clearPersistedSession()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("clearPersistedSession does not throw when nothing is stored", () => {
    expect(() => clearPersistedSession()).not.toThrow()
  })
})
