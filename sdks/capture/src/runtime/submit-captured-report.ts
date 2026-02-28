import { CAPTURE_CORE_VERSION } from "@crikket/capture-core"
import { BUG_REPORT_VISIBILITY_OPTIONS } from "@crikket/shared/constants/bug-report"
import { defaultSubmitTransport } from "../transport/default-submit-transport"
import type {
  CapturedMedia,
  CaptureRuntimeConfig,
  CaptureSubmissionDraft,
  CaptureSubmitResult,
  CaptureSubmitTransport,
  ReviewSnapshot,
} from "../types"
import { getDeviceInfo, getPageTitle, getPageUrl } from "../utils"

export function submitCapturedReport(input: {
  config: CaptureRuntimeConfig
  draft: CaptureSubmissionDraft
  media: CapturedMedia
  review: ReviewSnapshot
  submitTransport?: CaptureSubmitTransport
}): Promise<CaptureSubmitResult> {
  const submitTransport = input.submitTransport ?? defaultSubmitTransport

  return submitTransport({
    config: input.config,
    report: {
      captureType: input.media.captureType,
      title: input.draft.title.trim(),
      description: input.draft.description.trim(),
      priority: input.draft.priority,
      visibility:
        input.draft.visibility ?? BUG_REPORT_VISIBILITY_OPTIONS.private,
      pageUrl: getPageUrl(),
      pageTitle: getPageTitle(),
      durationMs: input.media.durationMs,
      deviceInfo: getDeviceInfo(),
      sdkVersion: CAPTURE_CORE_VERSION,
      debuggerPayload: input.review.debuggerPayload,
      debuggerSummary: input.review.debuggerSummary,
      media: input.media.blob,
    },
  })
}
