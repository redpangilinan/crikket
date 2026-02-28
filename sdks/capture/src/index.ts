import { CAPTURE_CORE_VERSION } from "@crikket/capture-core"
import { LazyCaptureSdkRuntime } from "./runtime/lazy-capture-runtime"
import type {
  CaptureInitOptions,
  CaptureRuntimeController,
  CaptureSubmissionDraft,
  CaptureSubmitResult,
} from "./types"

export { defaultSubmitTransport } from "./transport/default-submit-transport"
export type {
  CaptureDebuggerSummary,
  CaptureInitOptions,
  CapturePriority,
  CaptureReportVisibility,
  CaptureRuntimeConfig,
  CaptureRuntimeController,
  CaptureSubmissionDraft,
  CaptureSubmitRequest,
  CaptureSubmitResult,
  CaptureSubmitTransport,
  CaptureType,
} from "./types"

const runtime = new LazyCaptureSdkRuntime()

export function init(options: CaptureInitOptions): CaptureRuntimeController {
  return runtime.init(options)
}

export function mount(target?: HTMLElement): void {
  runtime.mount(target)
}

export function unmount(): void {
  runtime.unmount()
}

export function open(): void {
  runtime.open()
}

export function close(): void {
  runtime.close()
}

export function destroy(): void {
  runtime.destroy()
}

export function startRecording(): Promise<{ startedAt: number }> {
  return runtime.startRecording()
}

export function stopRecording(): Promise<Blob | null> {
  return runtime.stopRecording()
}

export function takeScreenshot(): Promise<Blob | null> {
  return runtime.takeScreenshot()
}

export function submit(
  draft: CaptureSubmissionDraft
): Promise<CaptureSubmitResult> {
  return runtime.submit(draft)
}

export function reset(): void {
  runtime.reset()
}

export function isInitialized(): boolean {
  return runtime.isInitialized()
}

export function getConfig() {
  return runtime.getConfig()
}

export function getCoreVersion(): string {
  return CAPTURE_CORE_VERSION
}
