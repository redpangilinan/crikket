import { describe, expect, it } from "bun:test"

import { MAX_RECENT_EVENT_AGE_MS } from "../src/constants"
import {
  getCaptureSdk,
  sdkTestState,
  setupCaptureSdkTestHooks,
} from "./lib/sdk-test-harness"

setupCaptureSdkTestHooks()

describe("capture SDK capture failure regression", () => {
  it("restores UI state and clears the debugger session when screenshot capture fails", async () => {
    const capture = getCaptureSdk()

    capture.init({
      key: "crk_capture_failure",
      host: "https://api.crikket.io",
    })

    sdkTestState.screenshotError = new Error(
      "Screen capture permission denied."
    )

    await expect(capture.takeScreenshot()).rejects.toThrow(
      "Screen capture permission denied."
    )

    expect(sdkTestState.startSessionCalls).toEqual([
      {
        captureType: "screenshot",
        lookbackMs: MAX_RECENT_EVENT_AGE_MS,
      },
    ])
    expect(sdkTestState.uiHidden).toEqual([true, false])
    expect(sdkTestState.clearSessionCalls).toBe(1)
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(0)
    expect(sdkTestState.objectUrlsCreated).toEqual([])
  })
})
