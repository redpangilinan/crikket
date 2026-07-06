import { isPlatformBrowser } from "@angular/common"
import { Injectable, inject, PLATFORM_ID } from "@angular/core"
import {
  CRIKKET_CONFIG,
  type CrikketConfig,
  DEFAULT_CRIKKET_HOST,
} from "./crikket.config"

type CrikketCaptureModule = typeof import("@crikket-io/capture")

/**
 * Loads and controls the `@crikket-io/capture` bug-reporting widget.
 *
 * The SDK is imported lazily (`import("@crikket-io/capture")`) the first time it
 * is needed, so it is emitted as a separate chunk and never loaded during
 * server-side rendering. Initialization is normally driven by
 * {@link provideCrikket} / {@link CrikketModule} via an `APP_INITIALIZER`, but
 * the runtime controls (`open`, `close`, ...) can be called from anywhere the
 * service is injected.
 */
@Injectable({ providedIn: "root" })
export class CrikketService {
  private readonly platformId = inject(PLATFORM_ID)
  private readonly injectedConfig = inject(CRIKKET_CONFIG, { optional: true })

  private sdk: CrikketCaptureModule | null = null
  private loadPromise: Promise<CrikketCaptureModule | null> | null = null
  private initialized = false

  /** True when running in a browser (false during SSR). */
  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId)
  }

  /** Whether the SDK has been initialized. */
  get isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Loads the SDK and initializes the capture widget. Safe to call multiple
   * times - subsequent calls are no-ops. No-op during SSR, when `enabled` is
   * `false`, or when no `key` is configured.
   */
  async init(
    config: CrikketConfig | null = this.injectedConfig
  ): Promise<void> {
    if (this.initialized || !this.isBrowser) {
      return
    }
    if (!config || config.enabled === false) {
      return
    }
    if (!config.key) {
      console.warn(
        '[capture-angular] No "key" configured; capture SDK not initialized.'
      )
      return
    }

    const sdk = await this.load()
    if (!sdk) {
      return
    }

    sdk.init({
      key: config.key,
      host: config.host ?? DEFAULT_CRIKKET_HOST,
      autoMount: config.autoMount,
      mountTarget: config.mountTarget,
      submitPath: config.submitPath,
      zIndex: config.zIndex,
    })
    this.initialized = true
  }

  /** Opens the capture widget. Loads the SDK first if needed. */
  async open(): Promise<void> {
    ;(await this.load())?.open()
  }

  /** Closes the capture widget. */
  close(): void {
    this.sdk?.close()
  }

  /** Mounts the launcher into `target` (or the default location). */
  async mount(target?: HTMLElement): Promise<void> {
    ;(await this.load())?.mount(target)
  }

  /** Removes the launcher from the DOM without tearing down the SDK. */
  unmount(): void {
    this.sdk?.unmount()
  }

  /** Fully tears down the widget and resets initialization state. */
  destroy(): void {
    this.sdk?.destroy()
    this.initialized = false
  }

  /** Starts a screen recording. Resolves with the start timestamp. */
  async startRecording(): Promise<{ startedAt: number } | undefined> {
    return (await this.load())?.startRecording()
  }

  /** Stops the current recording and resolves with the captured media. */
  async stopRecording(): Promise<Blob | null | undefined> {
    return await this.sdk?.stopRecording()
  }

  /** Captures a screenshot and resolves with the image blob. */
  async takeScreenshot(): Promise<Blob | null | undefined> {
    return (await this.load())?.takeScreenshot()
  }

  /**
   * Lazily imports `@crikket-io/capture`. Returns `null` (and logs) if the
   * package is not installed or fails to load, so callers degrade gracefully.
   */
  private load(): Promise<CrikketCaptureModule | null> {
    if (!this.isBrowser) {
      return Promise.resolve(null)
    }
    if (this.sdk) {
      return Promise.resolve(this.sdk)
    }
    if (!this.loadPromise) {
      this.loadPromise = import("@crikket-io/capture")
        .then((module) => {
          this.sdk = module
          return module
        })
        .catch((error: unknown) => {
          console.error(
            '[capture-angular] Failed to load "@crikket-io/capture". Is it installed as a peer dependency?',
            error
          )
          this.loadPromise = null
          return null
        })
    }
    return this.loadPromise
  }
}
