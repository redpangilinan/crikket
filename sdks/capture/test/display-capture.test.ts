import { afterEach, describe, expect, it } from "bun:test"

import { captureScreenshot } from "../src/media/capture-screenshot"
import {
  requestDisplayStream,
  supportsDisplayAudioCapture,
} from "../src/media/display-capture"
import { startDisplayRecording } from "../src/media/start-display-recording"

// Regression coverage for the surface gate that made desktop Firefox unable to
// capture at all: Firefox has no `displaySurface` member in MediaTrackSettings
// and never offers a browser-tab surface, so a returned stream must be accepted
// on its own terms. A cancelled picker must reject once, not re-prompt.

type FakeTrack = {
  getSettings: () => MediaTrackSettings
  stopCalls: number
}

const originalNavigator = globalThis.navigator
const originalWindow = (globalThis as { window?: unknown }).window
const originalDocument = (globalThis as { document?: unknown }).document
const originalMediaRecorder = (globalThis as { MediaRecorder?: unknown })
  .MediaRecorder

const FIREFOX_SETTINGS = {
  frameRate: 30,
  height: 1326,
  width: 1718,
} as MediaTrackSettings

const CHROME_WINDOW_SETTINGS = {
  displaySurface: "window",
  frameRate: 30,
  height: 1326,
  width: 1718,
} as MediaTrackSettings

function createFakeStream(settings: MediaTrackSettings): {
  stream: MediaStream
  track: FakeTrack
} {
  const track = {
    getSettings: () => settings,
    stopCalls: 0,
    kind: "video",
    muted: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    stop() {
      track.stopCalls += 1
    },
  }

  return {
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream,
    track: track as unknown as FakeTrack,
  }
}

function setNavigator(value: Record<string, unknown>): void {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  })
}

function installDisplayMedia(options: {
  result: MediaStream | Error
  supportedConstraints?: Record<string, boolean>
}): { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = []

  setNavigator({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; rv:155.0) Gecko/20100101 Firefox/155.0",
    mediaDevices: {
      getDisplayMedia: (constraints: Record<string, unknown>) => {
        calls.push(constraints)

        if (options.result instanceof Error) {
          return Promise.reject(options.result)
        }

        return Promise.resolve(options.result)
      },
      getSupportedConstraints: () => options.supportedConstraints ?? {},
    },
  })

  return { calls }
}

function installCaptureDom(): { blob: Blob } {
  const blob = new Blob(["png"], { type: "image/png" })

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tag: string) =>
        tag === "video" ? createVideoStub() : createCanvasStub(blob),
    },
  })

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout: (id: number) => clearTimeout(id),
      setTimeout: (handler: () => void, timeout?: number) =>
        setTimeout(handler, timeout),
    },
  })

  return { blob }
}

function createVideoStub() {
  return {
    addEventListener: (type: string, handler: () => void) => {
      if (type === "loadedmetadata") {
        setTimeout(handler, 0)
      }
    },
    muted: false,
    pause: () => undefined,
    play: () => Promise.resolve(),
    playsInline: false,
    removeEventListener: () => undefined,
    requestVideoFrameCallback: (handler: () => void) => {
      setTimeout(handler, 0)
    },
    srcObject: null as unknown,
    videoHeight: 1326,
    videoWidth: 1718,
  }
}

function createCanvasStub(blob: Blob) {
  return {
    getContext: () => ({
      drawImage: () => undefined,
    }),
    height: 0,
    toBlob: (callback: (value: Blob | null) => void) => {
      callback(blob)
    },
    width: 0,
  }
}

function installMediaRecorder(): { instances: number } {
  const state = { instances: 0 }

  class FakeMediaRecorder {
    state = "recording"

    constructor() {
      state.instances += 1
    }

    static isTypeSupported(): boolean {
      return true
    }

    addEventListener(): void {
      // no-op
    }

    start(): void {
      // no-op
    }

    stop(): void {
      this.state = "inactive"
    }
  }

  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: FakeMediaRecorder,
  })

  return state
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator,
  })
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  })
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
  })
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: originalMediaRecorder,
  })
})

describe("captureScreenshot surface handling", () => {
  it("accepts a Firefox stream whose settings have no displaySurface", async () => {
    const { stream, track } = createFakeStream(FIREFOX_SETTINGS)
    installDisplayMedia({ result: stream })
    const { blob } = installCaptureDom()

    await expect(captureScreenshot()).resolves.toBe(blob)
    expect(track.stopCalls).toBe(1)
  })

  it("accepts a window surface the user deliberately chose", async () => {
    const { stream } = createFakeStream(CHROME_WINDOW_SETTINGS)
    installDisplayMedia({ result: stream })
    const { blob } = installCaptureDom()

    await expect(captureScreenshot()).resolves.toBe(blob)
  })
})

describe("startDisplayRecording surface handling", () => {
  it("records a Firefox stream whose settings have no displaySurface", async () => {
    const { stream } = createFakeStream(FIREFOX_SETTINGS)
    installDisplayMedia({ result: stream })
    installCaptureDom()
    const recorder = installMediaRecorder()

    const controller = await startDisplayRecording()

    expect(recorder.instances).toBe(1)
    expect(typeof controller.stop).toBe("function")
  })
})

describe("requestDisplayStream", () => {
  it("rejects a cancelled picker once instead of re-prompting", async () => {
    const cancelled = new Error("Permission denied by user")
    cancelled.name = "NotAllowedError"
    const { calls } = installDisplayMedia({
      result: cancelled,
      supportedConstraints: { suppressLocalAudioPlayback: true },
    })

    await expect(requestDisplayStream(true)).rejects.toThrow(
      "Permission denied by user"
    )
    expect(calls).toHaveLength(1)
  })

  it("requests audio only where display audio capture is implemented", async () => {
    const { stream } = createFakeStream(FIREFOX_SETTINGS)
    const withoutAudio = installDisplayMedia({ result: stream })

    await requestDisplayStream(true)
    expect(withoutAudio.calls[0]?.audio).toBe(false)
    expect(withoutAudio.calls[0]?.systemAudio).toBe("exclude")

    const withAudio = installDisplayMedia({
      result: stream,
      supportedConstraints: { suppressLocalAudioPlayback: true },
    })

    await requestDisplayStream(true)
    expect(withAudio.calls[0]?.audio).toBe(true)
    expect(withAudio.calls[0]?.systemAudio).toBe("include")
  })

  it("detects display audio support from getSupportedConstraints", () => {
    installDisplayMedia({
      result: new Error("unused"),
      supportedConstraints: { echoCancellation: true },
    })
    expect(supportsDisplayAudioCapture()).toBe(false)

    installDisplayMedia({
      result: new Error("unused"),
      supportedConstraints: { suppressLocalAudioPlayback: true },
    })
    expect(supportsDisplayAudioCapture()).toBe(true)
  })
})
