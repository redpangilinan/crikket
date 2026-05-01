import { describe, expect, it } from "bun:test"

import {
  createSubmitTransport,
  getCaptureSdk,
  sdkTestState,
  setupCaptureSdkTestHooks,
  waitFor,
} from "./lib/sdk-test-harness"

setupCaptureSdkTestHooks()

describe("cross-page recording resume", () => {
  it("does not start a new session or show the chooser when init detects no persisted session", async () => {
    const capture = getCaptureSdk()
    // restoredSessionStartedAt is null by default

    capture.init({ key: "crk_no_session", host: "https://api.crikket.io" })
    await new Promise((r) => setTimeout(r, 20))

    expect(sdkTestState.startSessionCalls).toHaveLength(0)
    expect(sdkTestState.uiOpenChooserCalls).toBe(0)
  })

  it("does not start a new session when init detects a persisted session", async () => {
    const capture = getCaptureSdk()
    sdkTestState.restoredSessionStartedAt = 1_700_000_000_000

    capture.init({ key: "crk_resumed", host: "https://api.crikket.io" })
    await new Promise((r) => setTimeout(r, 20))

    // The resume path should NOT call startSession — that would be a fresh session
    expect(sdkTestState.startSessionCalls).toHaveLength(0)
    // And it should NOT open the chooser — the dock shows instead
    expect(sdkTestState.uiOpenChooserCalls).toBe(0)
  })

  it("completes a screenshot capture when stop is called without an active recording (cross-page fallback)", async () => {
    const capture = getCaptureSdk()
    sdkTestState.restoredSessionStartedAt = 1_700_000_000_000

    capture.init({
      key: "crk_cross_page_stop",
      host: "https://api.crikket.io",
      submitTransport: createSubmitTransport(),
    })
    await new Promise((r) => setTimeout(r, 20))

    // Take a screenshot via the public API (simulates stop with no active recording)
    const blob = await capture.takeScreenshot()
    expect(blob).toBe(sdkTestState.screenshotBlob)

    // A session was started (for the screenshot) and finalized
    expect(sdkTestState.startSessionCalls).toHaveLength(1)
    expect(sdkTestState.startSessionCalls[0]).toMatchObject({ captureType: "screenshot" })
    expect(sdkTestState.finalizeSessionCalls).toBe(1)
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(1)
    expect(sdkTestState.uiShowReviewInputs[0].media.captureType).toBe("screenshot")
  })

  it("completes a full recording flow after resuming a persisted session", async () => {
    const capture = getCaptureSdk()
    sdkTestState.restoredSessionStartedAt = 1_700_000_000_000

    capture.init({
      key: "crk_cross_page_recording",
      host: "https://api.crikket.io",
      submitTransport: createSubmitTransport(),
    })
    await new Promise((r) => setTimeout(r, 20))

    // User starts a fresh recording on the new page
    const startResult = await capture.startRecording()
    expect(startResult).toEqual({ startedAt: 1_700_000_000_000 })
    expect(sdkTestState.startSessionCalls).toHaveLength(1)
    expect(sdkTestState.startSessionCalls[0]).toMatchObject({ captureType: "video" })

    // User stops the recording
    const recordingBlob = await capture.stopRecording()
    expect(recordingBlob).toBe(sdkTestState.recordingBlob)
    expect(sdkTestState.finalizeSessionCalls).toBe(1)
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(1)
    expect(sdkTestState.uiShowReviewInputs[0].media.captureType).toBe("video")
  })
})
