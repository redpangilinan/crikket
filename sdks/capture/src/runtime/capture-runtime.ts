import { LazyDebuggerCollector } from "../debugger/lazy-debugger-collector"
import { loadPersistedSession } from "../debugger/session-storage"
import {
  captureScreenshot,
  startDisplayRecording,
} from "../media/lazy-capture-media"
import type {
  CapturedMedia,
  CaptureInitOptions,
  CaptureRuntimeConfig,
  CaptureRuntimeController,
  CaptureSubmissionDraft,
  CaptureSubmitTransport,
  RecordingController,
  ReviewSnapshot,
} from "../types"
import { mountCaptureUi } from "../ui/mount-capture-ui"
import type { CaptureReviewSubmitOptions, MountedCaptureUi } from "../ui/types"
import {
  normalizeHost,
  normalizeKey,
  normalizeSubmitPath,
  normalizeZIndex,
} from "../utils"

export class CaptureSdkRuntime implements CaptureRuntimeController {
  private runtimeConfig: CaptureRuntimeConfig | null = null
  private submitTransport: CaptureSubmitTransport | undefined
  private mountedTarget: HTMLElement | null = null
  private mountedUi: MountedCaptureUi | null = null
  private readonly debuggerCollector = new LazyDebuggerCollector()
  private activeRecording: RecordingController | null = null
  private currentMedia: CapturedMedia | null = null
  private currentReview: ReviewSnapshot | null = null

  init(options: CaptureInitOptions): CaptureRuntimeController {
    const config: CaptureRuntimeConfig = {
      key: normalizeKey(options.key),
      host: normalizeHost(options.host),
      submitPath: normalizeSubmitPath(options.submitPath),
      zIndex: normalizeZIndex(options.zIndex),
    }

    this.runtimeConfig = config
    this.submitTransport = options.submitTransport

    if (options.autoMount ?? true) {
      this.mount(options.mountTarget)
    }

    if (loadPersistedSession()) {
      this.resumePersistedSession()
    }

    return this
  }

  isInitialized(): boolean {
    return this.runtimeConfig !== null
  }

  getConfig(): CaptureRuntimeConfig | null {
    return this.runtimeConfig
  }

  mount(target?: HTMLElement): void {
    const config = this.getRuntimeConfig()
    this.ensureBrowserContext()

    if (this.mountedTarget) {
      return
    }

    const mountTarget = target ?? document.body
    this.mountedUi = mountCaptureUi(mountTarget, config.zIndex, {
      onClose: () => {
        this.close()
      },
      onStartVideo: () => {
        return this.startRecording()
      },
      onTakeScreenshot: async () => {
        const blob = await this.takeScreenshot()
        if (!blob) {
          throw new Error("Screenshot capture failed.")
        }
      },
      onStopRecording: async () => {
        if (this.activeRecording) {
          const blob = await this.stopRecording()
          if (!blob) {
            throw new Error("Recording capture failed.")
          }
        } else {
          const blob = await this.takeScreenshot()
          if (!blob) {
            throw new Error("Screenshot capture failed.")
          }
        }
      },
      onSubmit: (draft, options) => {
        return this.submit(draft, options).then(() => undefined)
      },
      onReset: () => {
        this.reset()
      },
    })
    this.mountedTarget = mountTarget
  }

  unmount(): void {
    this.abortActiveRecording()
    this.setUiHidden(false)
    this.mountedUi?.unmount()
    this.mountedUi = null
    this.debuggerCollector.dispose()
    this.mountedTarget = null
  }

  open(): void {
    this.getRuntimeConfig()
    if (!this.mountedTarget) {
      this.mount()
    }

    this.mountedUi?.store.openChooser()
  }

  close(): void {
    this.setUiHidden(false)
    this.mountedUi?.store.close()
  }

  destroy(): void {
    this.reset()
    this.unmount()
    this.runtimeConfig = null
    this.submitTransport = undefined
  }

  async startRecording(): Promise<{ startedAt: number }> {
    this.getRuntimeConfig()
    this.ensureBrowserContext()
    this.abortActiveRecording()
    await this.debuggerCollector.startRecordingSession()

    try {
      await this.hideUiForCapture()
      const controller = await startDisplayRecording()
      this.debuggerCollector.markRecordingStarted(controller.startedAt)
      this.activeRecording = controller
      controller.finished
        .then(async (result) => {
          if (this.activeRecording !== controller) {
            return
          }

          this.activeRecording = null
          await this.finalizeCapturedMedia({
            blob: result.blob,
            captureType: "video",
            durationMs: result.durationMs,
          })
        })
        .catch(() => undefined)

      return {
        startedAt: controller.startedAt,
      }
    } catch (error) {
      this.setUiHidden(false)
      this.debuggerCollector.clearSession()
      throw error
    }
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.activeRecording) {
      return null
    }

    const recording = this.activeRecording
    this.activeRecording = null

    const result = await recording.stop()
    await this.finalizeCapturedMedia({
      blob: result.blob,
      captureType: "video",
      durationMs: result.durationMs,
    })

    return result.blob
  }

  async takeScreenshot(): Promise<Blob | null> {
    this.getRuntimeConfig()
    this.ensureBrowserContext()
    await this.debuggerCollector.startScreenshotSession()

    let blob: Blob
    try {
      await this.hideUiForCapture()
      blob = await captureScreenshot()
    } catch (error) {
      this.setUiHidden(false)
      this.debuggerCollector.clearSession()
      throw error
    }
    await this.finalizeCapturedMedia({
      blob,
      captureType: "screenshot",
      durationMs: null,
    })

    return blob
  }

  async submit(
    draft: CaptureSubmissionDraft,
    options?: CaptureReviewSubmitOptions
  ) {
    const config = this.getRuntimeConfig()
    if (!(this.currentMedia && this.currentReview)) {
      throw new Error(
        "No capture is ready to submit. Start a recording or take a screenshot first."
      )
    }

    const { submitCapturedReport } = await import("./submit-captured-report")
    const media =
      this.currentMedia.captureType === "screenshot" &&
      options?.screenshotBlobOverride
        ? {
            ...this.currentMedia,
            blob: options.screenshotBlobOverride,
          }
        : this.currentMedia
    const result = await submitCapturedReport({
      config,
      draft,
      media,
      review: this.currentReview,
      submitTransport: this.submitTransport,
    })

    if (this.mountedUi) {
      this.mountedUi.store.showSuccess(result.shareUrl)
    }

    return result
  }

  reset(): void {
    this.abortActiveRecording()
    this.setUiHidden(false)
    this.clearMedia()
    this.currentReview = null
    this.debuggerCollector.clearSession()
  }

  private setMedia(input: {
    blob: Blob
    captureType: CapturedMedia["captureType"]
    durationMs: number | null
  }): CapturedMedia {
    this.clearMedia()

    this.currentMedia = {
      blob: input.blob,
      captureType: input.captureType,
      durationMs: input.durationMs,
      objectUrl: URL.createObjectURL(input.blob),
    }

    return this.currentMedia
  }

  private clearMedia(): void {
    if (!this.currentMedia) {
      return
    }

    URL.revokeObjectURL(this.currentMedia.objectUrl)
    this.currentMedia = null
  }

  private finalizeCapturedMedia(input: {
    blob: Blob
    captureType: CapturedMedia["captureType"]
    durationMs: number | null
  }): void {
    this.setUiHidden(false)

    const review = this.debuggerCollector.finalizeSession()
    const media = this.setMedia(input)

    this.currentReview = review
    if (!this.mountedUi) {
      return
    }

    this.mountedUi.store.showReview({
      media,
      warnings: review.warnings,
      summary: review.debuggerSummary,
    })
    this.prefillTitle()
  }

  private abortActiveRecording(): void {
    if (!this.activeRecording) {
      return
    }

    this.activeRecording.abort()
    this.activeRecording = null
  }

  private async hideUiForCapture(): Promise<void> {
    this.setUiHidden(true)
    await waitForNextPaint()
  }

  private setUiHidden(hidden: boolean): void {
    this.mountedUi?.setHidden(hidden)
  }

  private prefillTitle(): void {
    const captureTitle = document.title.trim()
    if (captureTitle.length === 0) {
      return
    }

    this.mountedUi?.store.setTitleIfEmpty(captureTitle)
  }

  private resumePersistedSession(): void {
    this.debuggerCollector
      .ensureSessionRestored()
      .then((startedAt) => {
        if (startedAt !== null) {
          this.mountedUi?.store.showRecording(startedAt)
        }
      })
      .catch(() => undefined)
  }

  private getRuntimeConfig(): CaptureRuntimeConfig {
    if (!this.runtimeConfig) {
      throw new Error(
        "Capture SDK is not initialized. Call capture.init({ key }) first."
      )
    }

    return this.runtimeConfig
  }

  private ensureBrowserContext(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("Capture SDK can only run in a browser environment.")
    }
  }
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}
