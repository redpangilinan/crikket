import { InjectionToken } from "@angular/core"

/** Default Crikket hosted backend. */
export const DEFAULT_CRIKKET_HOST = "https://api.crikket.io"

/** Configuration for the Crikket capture SDK. */
export interface CrikketConfig {
  /** Public capture key (`crk_...`) from `Settings` -> `Public Keys`. */
  key: string
  /**
   * Crikket backend base URL. Defaults to {@link DEFAULT_CRIKKET_HOST}.
   * Set this to your own origin when self-hosting Crikket.
   */
  host?: string
  /**
   * When `false`, the SDK is never loaded or initialized - nothing is fetched
   * and no widget is mounted. Use this to keep the capture widget out of
   * production, e.g. `enabled: environment.name !== "production"`.
   * Defaults to `true`.
   */
  enabled?: boolean
  /** Auto-mount the capture launcher after init. Defaults to the SDK default. */
  autoMount?: boolean
  /** Custom DOM element to mount the widget into. */
  mountTarget?: HTMLElement
  /** Custom public ingest path on the backend. */
  submitPath?: string
  /** Stacking order (`z-index`) for the widget. */
  zIndex?: number
}

/** DI token holding the resolved {@link CrikketConfig}. */
export const CRIKKET_CONFIG = new InjectionToken<CrikketConfig>(
  "CRIKKET_CONFIG"
)
