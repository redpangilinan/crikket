import { describe, expect, it } from "bun:test"

import { SCREENSHOT_LOOKBACK_MS } from "../src/constants"
import {
  browserTarget,
  createSubmitTransport,
  getCaptureSdk,
  sdkTestState,
  setupCaptureSdkTestHooks,
  waitFor,
} from "./lib/sdk-test-harness"

setupCaptureSdkTestHooks()

describe("capture SDK screenshot flow", () => {
  it("completes the screenshot flow from init through successful submit", async () => {
    const capture = getCaptureSdk()

    capture.init({
      key: "  crk_screenshot_flow  ",
      host: "https://api.crikket.io",
      submitTransport: createSubmitTransport(),
    })

    expect(capture.isInitialized()).toBe(true)
    expect(capture.getConfig()).toEqual({
      host: "https://api.crikket.io",
      key: "crk_screenshot_flow",
      submitPath: "/api/embed/bug-reports",
      zIndex: 2_147_483_640,
    })
    expect(sdkTestState.launcherMounts).toEqual([
      {
        target: browserTarget,
        zIndex: 2_147_483_640,
      },
    ])

    capture.open()
    await waitFor(() => sdkTestState.uiOpenChooserCalls === 1)

    const screenshotBlob = await capture.takeScreenshot()
    expect(screenshotBlob).toBe(sdkTestState.screenshotBlob)
    expect(sdkTestState.startSessionCalls).toEqual([
      {
        captureType: "screenshot",
        lookbackMs: SCREENSHOT_LOOKBACK_MS,
      },
    ])
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(1)
    expect(sdkTestState.uiShowReviewInputs[0]).toMatchObject({
      media: {
        blob: sdkTestState.screenshotBlob,
        captureType: "screenshot",
        durationMs: null,
      },
      summary: sdkTestState.reviewSnapshot.debuggerSummary,
      warnings: sdkTestState.reviewSnapshot.warnings,
    })
    expect(sdkTestState.uiHidden).toEqual([true, false])
    expect(sdkTestState.titlePrefills).toEqual(["Buggy Checkout"])

    const submitResult = await capture.submit({
      title: " Checkout submit is broken ",
      description: " Description from regression test ",
      priority: "high",
    })

    expect(submitResult).toEqual({
      reportId: "br_123",
      shareUrl: "https://app.crikket.io/s/br_123",
    })
    expect(sdkTestState.submitRequests).toHaveLength(1)
    expect(sdkTestState.submitRequests[0]).toMatchObject({
      config: {
        host: "https://api.crikket.io",
        key: "crk_screenshot_flow",
        submitPath: "/api/embed/bug-reports",
        zIndex: 2_147_483_640,
      },
      report: {
        captureType: "screenshot",
        title: "Checkout submit is broken",
        description: "Description from regression test",
        priority: "high",
        visibility: "private",
        pageTitle: "Buggy Checkout",
        pageUrl: "https://example.com/checkout",
        durationMs: null,
        debuggerSummary: sdkTestState.reviewSnapshot.debuggerSummary,
        media: sdkTestState.screenshotBlob,
      },
    })
    expect(sdkTestState.uiShowSuccessUrls).toEqual([
      "https://app.crikket.io/s/br_123",
    ])

    capture.close()
    expect(sdkTestState.uiCloseCalls).toBe(1)

    capture.destroy()
    expect(sdkTestState.objectUrlsRevoked).toEqual(["blob:mock-1"])
    expect(sdkTestState.uiUnmounts).toBe(1)
    expect(capture.isInitialized()).toBe(false)
  })
})
