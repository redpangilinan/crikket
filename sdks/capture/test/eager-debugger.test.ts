import { describe, expect, it } from "bun:test"

import {
  MAX_RECENT_EVENT_AGE_MS,
  SCREENSHOT_LOOKBACK_MS,
} from "../src/constants"
import {
  getCaptureSdk,
  sdkTestState,
  setupCaptureSdkTestHooks,
  waitFor,
} from "./lib/sdk-test-harness"

setupCaptureSdkTestHooks()

// Regression coverage: the network/console collector must be installed at
// init() so requests made before the widget is opened are captured, not only
// from the moment the capture button is pressed.

describe("capture SDK eager debugger collection", () => {
  it("installs the debugger collector at init by default, before any capture", async () => {
    const capture = getCaptureSdk()

    capture.init({
      key: "crk_eager",
      host: "https://api.crikket.io",
    })

    await waitFor(() => sdkTestState.installCalls === 1)

    // Installed, but no capture session has started yet.
    expect(sdkTestState.startSessionCalls).toEqual([])
  })

  it("replays the full retained buffer as the screenshot lookback when eager", async () => {
    const capture = getCaptureSdk()

    capture.init({ key: "crk_eager", host: "https://api.crikket.io" })
    await waitFor(() => sdkTestState.installCalls === 1)

    await capture.takeScreenshot()

    expect(sdkTestState.startSessionCalls).toEqual([
      { captureType: "screenshot", lookbackMs: MAX_RECENT_EVENT_AGE_MS },
    ])
    // Collector installed exactly once (warm-up reused by the capture session).
    expect(sdkTestState.installCalls).toBe(1)
  })

  it("defers installation to first capture when collectDebuggerEagerly is false", async () => {
    const capture = getCaptureSdk()

    capture.init({
      key: "crk_lazy",
      host: "https://api.crikket.io",
      collectDebuggerEagerly: false,
    })

    // Give any accidental warm-up a chance to run.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(sdkTestState.installCalls).toBe(0)

    await capture.takeScreenshot()

    expect(sdkTestState.installCalls).toBe(1)
    expect(sdkTestState.startSessionCalls).toEqual([
      { captureType: "screenshot", lookbackMs: SCREENSHOT_LOOKBACK_MS },
    ])
  })
})
