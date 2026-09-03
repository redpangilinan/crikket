import {
  attachScreenshotFile,
  close,
  defaultSubmitTransport,
  destroy,
  getConfig,
  init,
  isInitialized,
  mount,
  open,
  reset,
  startRecording,
  stopRecording,
  submit,
  takeScreenshot,
  unmount,
} from "./index"
import type { CaptureGlobalApi } from "./types"

const capture = {
  attachScreenshotFile,
  close,
  defaultSubmitTransport,
  destroy,
  getConfig,
  init,
  isInitialized,
  mount,
  open,
  reset,
  startRecording,
  stopRecording,
  submit,
  takeScreenshot,
  unmount,
} satisfies CaptureGlobalApi

declare global {
  interface Window {
    CrikketCapture?: CaptureGlobalApi
  }
}

if (typeof window !== "undefined") {
  window.CrikketCapture = capture
}
