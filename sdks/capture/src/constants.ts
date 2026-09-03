import type { CaptureLauncherPosition } from "./types"

export const DEFAULT_ENDPOINT = "https://api.crikket.io"
export const DEFAULT_SUBMIT_PATH = "/api/embed/bug-reports"
export const DEFAULT_Z_INDEX = 2_147_483_640
export const DEFAULT_LAUNCHER_POSITION: CaptureLauncherPosition = "bottom-right"
export const DEFAULT_LAUNCHER_OFFSET_PX = 24
export const MAX_RECENT_EVENT_AGE_MS = 60_000
export const MAX_RECENT_EVENT_COUNT = 250
export const SCREENSHOT_LOOKBACK_MS = 10_000
export const TRAILING_SLASHES_REGEX = /\/+$/
