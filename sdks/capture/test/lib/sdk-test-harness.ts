import { afterAll, beforeAll, beforeEach, mock } from "bun:test"
import { fileURLToPath } from "node:url"

import type {
  CaptureSubmitRequest,
  CaptureSubmitResult,
  ReviewSnapshot,
} from "../../src/types"

const MOUNT_CAPTURE_LAUNCHER_PATH = fileURLToPath(
  new URL("../../src/ui/mount-capture-launcher.ts", import.meta.url)
)
const MOUNT_CAPTURE_UI_PATH = fileURLToPath(
  new URL("../../src/ui/mount-capture-ui.tsx", import.meta.url)
)
const CAPTURE_MEDIA_PATH = fileURLToPath(
  new URL("../../src/media/lazy-capture-media.ts", import.meta.url)
)
const DEBUGGER_COLLECTOR_PATH = fileURLToPath(
  new URL("../../src/debugger/debugger-collector.ts", import.meta.url)
)
const SESSION_STORAGE_PATH = fileURLToPath(
  new URL("../../src/debugger/session-storage.ts", import.meta.url)
)

type LauncherMount = {
  target: unknown
  zIndex: number
}

type UiMount = {
  target: unknown
  zIndex: number
}

type StartSessionCall = {
  captureType: "screenshot" | "video"
  lookbackMs?: number
}

type RecordingResult = {
  blob: Blob
  durationMs: number
}

type ReviewInput = {
  media: {
    blob: Blob
    captureType: "screenshot" | "video"
    durationMs: number | null
    objectUrl: string
  }
  warnings: string[]
  summary: ReviewSnapshot["debuggerSummary"]
}

export const browserTarget = {} as HTMLElement

export const sdkTestState = {
  launcherMounts: [] as LauncherMount[],
  launcherLoading: [] as boolean[],
  launcherUnmounts: 0,
  uiMounts: [] as UiMount[],
  uiHidden: [] as boolean[],
  uiOpenChooserCalls: 0,
  uiCloseCalls: 0,
  uiShowReviewInputs: [] as ReviewInput[],
  uiShowSuccessUrls: [] as Array<string | undefined>,
  titlePrefills: [] as string[],
  uiUnmounts: 0,
  startSessionCalls: [] as StartSessionCall[],
  markRecordingStartedCalls: [] as number[],
  finalizeSessionCalls: 0,
  clearSessionCalls: 0,
  disposeCalls: 0,
  screenshotBlob: new Blob(["screenshot"], { type: "image/png" }),
  recordingBlob: new Blob(["recording"], { type: "video/webm" }),
  recordingDurationMs: 4321,
  recordingStopCalls: 0,
  recordingAbortCalls: 0,
  submitRequests: [] as CaptureSubmitRequest[],
  restoredSessionStartedAt: null as number | null,
  screenshotError: null as Error | null,
  startRecordingError: null as Error | null,
  objectUrlsCreated: [] as string[],
  objectUrlsRevoked: [] as string[],
  reviewSnapshot: buildReviewSnapshot(),
}

let nextObjectUrlId = 0
let resolveRecordingFinished: ((value: RecordingResult) => void) | null = null
let captureModule: typeof import("../../src/index") | undefined

mock.module(MOUNT_CAPTURE_LAUNCHER_PATH, () => ({
  mountCaptureLauncher: (target: unknown, options: { zIndex: number }) => {
    sdkTestState.launcherMounts.push({
      target,
      zIndex: options.zIndex,
    })

    return {
      setLoading: (loading: boolean) => {
        sdkTestState.launcherLoading.push(loading)
      },
      unmount: () => {
        sdkTestState.launcherUnmounts += 1
      },
    }
  },
}))

mock.module(MOUNT_CAPTURE_UI_PATH, () => ({
  mountCaptureUi: (target: unknown, zIndex: number) => {
    sdkTestState.uiMounts.push({
      target,
      zIndex,
    })

    return {
      setHidden: (hidden: boolean) => {
        sdkTestState.uiHidden.push(hidden)
      },
      store: {
        getSnapshot: () => null,
        subscribe: () => () => undefined,
        patchState: () => undefined,
        openChooser: () => {
          sdkTestState.uiOpenChooserCalls += 1
        },
        close: () => {
          sdkTestState.uiCloseCalls += 1
        },
        showRecording: () => undefined,
        showReview: (input: ReviewInput) => {
          sdkTestState.uiShowReviewInputs.push(input)
        },
        showSuccess: (shareUrl?: string) => {
          sdkTestState.uiShowSuccessUrls.push(shareUrl)
        },
        showError: () => undefined,
        setTitleIfEmpty: (value: string) => {
          sdkTestState.titlePrefills.push(value)
        },
        destroy: () => undefined,
      },
      unmount: () => {
        sdkTestState.uiUnmounts += 1
      },
    }
  },
}))

mock.module(CAPTURE_MEDIA_PATH, () => ({
  captureScreenshot: () => {
    if (sdkTestState.screenshotError) {
      return Promise.reject(sdkTestState.screenshotError)
    }

    return Promise.resolve(sdkTestState.screenshotBlob)
  },
  startDisplayRecording: () => {
    if (sdkTestState.startRecordingError) {
      return Promise.reject(sdkTestState.startRecordingError)
    }

    const finished = new Promise<RecordingResult>((resolve) => {
      resolveRecordingFinished = resolve
    })

    return Promise.resolve({
      startedAt: 1_700_000_000_000,
      finished,
      stop: () => {
        sdkTestState.recordingStopCalls += 1
        const result = {
          blob: sdkTestState.recordingBlob,
          durationMs: sdkTestState.recordingDurationMs,
        }
        resolveRecordingFinished?.(result)
        return Promise.resolve(result)
      },
      abort: () => {
        sdkTestState.recordingAbortCalls += 1
      },
    })
  },
}))

mock.module(DEBUGGER_COLLECTOR_PATH, () => ({
  DebuggerCollector: class DebuggerCollector {
    install(): void {
      // Install work is irrelevant in the flow regression tests.
    }

    startSession(
      captureType: "screenshot" | "video",
      lookbackMs?: number
    ): void {
      sdkTestState.startSessionCalls.push({
        captureType,
        lookbackMs,
      })
    }

    markRecordingStarted(recordingStartedAt: number): void {
      sdkTestState.markRecordingStartedCalls.push(recordingStartedAt)
    }

    finalizeSession(): ReviewSnapshot {
      sdkTestState.finalizeSessionCalls += 1
      return sdkTestState.reviewSnapshot
    }

    clearSession(): void {
      sdkTestState.clearSessionCalls += 1
    }

    dispose(): void {
      sdkTestState.disposeCalls += 1
    }

    hasActiveSession(): boolean {
      return sdkTestState.restoredSessionStartedAt !== null
    }

    getSessionStartedAt(): number | null {
      return sdkTestState.restoredSessionStartedAt
    }
  },
}))

const STORAGE_KEY = "__crikketActiveSession"
const SESSION_VERSION = 1
const MAX_SESSION_AGE_MS = 5 * 60 * 1000

mock.module(SESSION_STORAGE_PATH, () => ({
  loadPersistedSession: () => {
    if (sdkTestState.restoredSessionStartedAt !== null) {
      return {
        sessionId: "mock-restored",
        captureType: "video" as const,
        startedAt: sdkTestState.restoredSessionStartedAt,
        recordingStartedAt: null,
        events: [],
      }
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw === null) return null

      const record = JSON.parse(raw) as Record<string, unknown>

      if (
        record.version !== SESSION_VERSION ||
        typeof record.savedAt !== "number" ||
        Date.now() - record.savedAt > MAX_SESSION_AGE_MS ||
        typeof record.sessionId !== "string" ||
        !record.sessionId ||
        (record.captureType !== "video" && record.captureType !== "screenshot") ||
        typeof record.startedAt !== "number"
      ) {
        sessionStorage.removeItem(STORAGE_KEY)
        return null
      }

      return {
        sessionId: record.sessionId as string,
        captureType: record.captureType as "video" | "screenshot",
        startedAt: record.startedAt as number,
        recordingStartedAt:
          typeof record.recordingStartedAt === "number"
            ? record.recordingStartedAt
            : null,
        events: Array.isArray(record.events)
          ? (record.events as unknown[]).filter(
              (e): e is { kind: string } =>
                typeof e === "object" &&
                e !== null &&
                typeof (e as Record<string, unknown>).kind === "string" &&
                ["action", "console", "network"].includes(
                  (e as Record<string, unknown>).kind as string
                )
            )
          : [],
      }
    } catch {
      return null
    }
  },
  persistSession: (session: {
    sessionId: string
    captureType: "video" | "screenshot"
    startedAt: number
    recordingStartedAt: number | null
    events: unknown[]
  }) => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...session, version: SESSION_VERSION, savedAt: Date.now() })
      )
    } catch {}
  },
  clearPersistedSession: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
  },
}))

export function setupCaptureSdkTestHooks(): void {
  beforeAll(async () => {
    captureModule = await import("../../src/index")
  })

  beforeEach(() => {
    captureModule?.destroy()
    resetSdkTestState()
    installBrowserGlobals()
  })

  afterAll(() => {
    resetSdkTestState()
    captureModule?.destroy()
    mock.restore()
  })
}

export function getCaptureSdk() {
  if (!captureModule) {
    throw new Error("Capture SDK test module is not loaded.")
  }

  return captureModule
}

export function createSubmitTransport(result?: CaptureSubmitResult) {
  return (request: CaptureSubmitRequest) => {
    sdkTestState.submitRequests.push(request)

    return Promise.resolve(
      result ?? {
        reportId: "br_123",
        shareUrl: "https://app.crikket.io/s/br_123",
      }
    )
  }
}

export function resetSdkTestState(): void {
  sdkTestState.launcherMounts = []
  sdkTestState.launcherLoading = []
  sdkTestState.launcherUnmounts = 0
  sdkTestState.uiMounts = []
  sdkTestState.uiHidden = []
  sdkTestState.uiOpenChooserCalls = 0
  sdkTestState.uiCloseCalls = 0
  sdkTestState.uiShowReviewInputs = []
  sdkTestState.uiShowSuccessUrls = []
  sdkTestState.titlePrefills = []
  sdkTestState.uiUnmounts = 0
  sdkTestState.startSessionCalls = []
  sdkTestState.markRecordingStartedCalls = []
  sdkTestState.finalizeSessionCalls = 0
  sdkTestState.clearSessionCalls = 0
  sdkTestState.disposeCalls = 0
  sdkTestState.screenshotBlob = new Blob(["screenshot"], { type: "image/png" })
  sdkTestState.recordingBlob = new Blob(["recording"], { type: "video/webm" })
  sdkTestState.recordingDurationMs = 4321
  sdkTestState.recordingStopCalls = 0
  sdkTestState.recordingAbortCalls = 0
  sdkTestState.submitRequests = []
  sdkTestState.restoredSessionStartedAt = null
  sdkTestState.screenshotError = null
  sdkTestState.startRecordingError = null
  sdkTestState.objectUrlsCreated = []
  sdkTestState.objectUrlsRevoked = []
  sdkTestState.reviewSnapshot = buildReviewSnapshot()
  nextObjectUrlId = 0
  resolveRecordingFinished = null
}

export async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000
): Promise<void> {
  const startedAt = Date.now()

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for capture SDK flow condition.")
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

function installBrowserGlobals(): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      innerHeight: 720,
      innerWidth: 1280,
    },
  })

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: browserTarget,
      title: "Buggy Checkout",
    },
  })

  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: {
      href: "https://example.com/checkout",
    },
  })

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      platform: "MacIntel",
      userAgent: "bun-test",
    },
  })

  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: (time: number) => void) => {
      callback(0)
      return 1
    },
  })

  URL.createObjectURL = (() => {
    const objectUrl = `blob:mock-${++nextObjectUrlId}`
    sdkTestState.objectUrlsCreated.push(objectUrl)
    return objectUrl
  }) as typeof URL.createObjectURL

  URL.revokeObjectURL = ((objectUrl: string) => {
    sdkTestState.objectUrlsRevoked.push(objectUrl)
  }) as typeof URL.revokeObjectURL
}

function buildReviewSnapshot(): ReviewSnapshot {
  return {
    warnings: ["Network request bodies were truncated."],
    debuggerSummary: {
      actions: 3,
      logs: 4,
      networkRequests: 5,
    },
    debuggerPayload: {
      actions: [],
      logs: [],
      networkRequests: [],
    },
  }
}
