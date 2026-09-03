import { describe, expect, it } from "bun:test"

import {
  createSubmitTransport,
  getCaptureSdk,
  sdkTestState,
  setupCaptureSdkTestHooks,
} from "./lib/sdk-test-harness"

setupCaptureSdkTestHooks()

const IMAGE_FILES_ERROR_REGEX = /image files/
const CHOOSE_IMAGE_ERROR_REGEX = /choose an image/

// Regression coverage: mobile browsers cannot use getDisplayMedia, so an
// uploaded image must be a first-class screenshot capture path that flows
// through the same review + submit pipeline without ever calling getDisplayMedia.

describe("capture SDK upload screenshot flow", () => {
  it("attaches an uploaded image as a screenshot and shows the review", async () => {
    const capture = getCaptureSdk()

    capture.init({
      key: "crk_upload",
      host: "https://api.crikket.io",
      submitTransport: createSubmitTransport(),
    })

    const uploaded = new Blob(["uploaded-image"], { type: "image/png" })
    const blob = await capture.attachScreenshotFile(uploaded)

    expect(blob).toBe(uploaded)
    // The uploaded blob, not a getDisplayMedia screenshot, is what gets reviewed.
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(1)
    expect(sdkTestState.uiShowReviewInputs[0]).toMatchObject({
      media: {
        blob: uploaded,
        captureType: "screenshot",
        durationMs: null,
      },
    })
    // No screen grab happened, so the widget UI is never hidden (only the
    // ensure-visible call from finalize, never hidden(true)).
    expect(sdkTestState.uiHidden).not.toContain(true)
    expect(sdkTestState.startSessionCalls).toEqual([
      { captureType: "screenshot", lookbackMs: expect.any(Number) },
    ])

    const result = await capture.submit({
      title: "Mobile bug",
      description: "From a phone",
      priority: "medium",
    })

    expect(result).toEqual({
      reportId: "br_123",
      shareUrl: "https://app.crikket.io/s/br_123",
    })
    expect(sdkTestState.submitRequests[0]).toMatchObject({
      report: { captureType: "screenshot", media: uploaded },
    })
  })

  it("rejects a non-image upload", async () => {
    const capture = getCaptureSdk()

    capture.init({ key: "crk_upload", host: "https://api.crikket.io" })

    const notImage = new Blob(["hello"], { type: "text/plain" })
    await expect(capture.attachScreenshotFile(notImage)).rejects.toThrow(
      IMAGE_FILES_ERROR_REGEX
    )
  })

  it("rejects an empty upload", async () => {
    const capture = getCaptureSdk()

    capture.init({ key: "crk_upload", host: "https://api.crikket.io" })

    const empty = new Blob([], { type: "image/png" })
    await expect(capture.attachScreenshotFile(empty)).rejects.toThrow(
      CHOOSE_IMAGE_ERROR_REGEX
    )
  })
})
