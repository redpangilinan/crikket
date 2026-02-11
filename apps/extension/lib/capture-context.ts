export type CaptureContext = { title?: string; url?: string }

export const CAPTURE_CONTEXT_STORAGE_KEY = "captureContext"
export const CAPTURE_TAB_ID_STORAGE_KEY = "captureTabId"
export const RECORDING_IN_PROGRESS_STORAGE_KEY = "recordingInProgress"
export const RECORDER_TAB_ID_STORAGE_KEY = "recorderTabId"
export const RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY =
  "recordingCountdownEndsAt"
export const RECORDING_STARTED_AT_STORAGE_KEY = "recordingStartedAt"
export const HOTKEY_START_VIDEO_CAPTURE_STORAGE_KEY = "hotkeyStartVideoCapture"
export const HOTKEY_START_SCREENSHOT_CAPTURE_STORAGE_KEY =
  "hotkeyStartScreenshotCapture"

const isExtensionUrl = (url?: string): boolean =>
  typeof url === "string" &&
  (url.startsWith("chrome-extension://") || url.startsWith("moz-extension://"))

export const sanitizeCaptureContext = (
  context?: CaptureContext
): CaptureContext => {
  if (!context) return {}
  if (isExtensionUrl(context.url)) return {}

  return {
    title: context.title ?? undefined,
    url: context.url ?? undefined,
  }
}

export const hasCaptureContext = (context: CaptureContext): boolean =>
  Boolean(context.title || context.url)

export const getActiveTabContext = async (): Promise<CaptureContext> => {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })
  const activeTab = tabs[0]

  return sanitizeCaptureContext({
    title: activeTab?.title ?? undefined,
    url: activeTab?.url ?? undefined,
  })
}

export const readAndClearStoredCaptureContext =
  async (): Promise<CaptureContext> => {
    const stored = await chrome.storage.local.get([CAPTURE_CONTEXT_STORAGE_KEY])
    await chrome.storage.local.remove([CAPTURE_CONTEXT_STORAGE_KEY])

    return sanitizeCaptureContext(
      stored[CAPTURE_CONTEXT_STORAGE_KEY] as CaptureContext | undefined
    )
  }

export const readAndClearCaptureTabId = async (): Promise<number | null> => {
  const stored = await chrome.storage.local.get([CAPTURE_TAB_ID_STORAGE_KEY])
  await chrome.storage.local.remove([CAPTURE_TAB_ID_STORAGE_KEY])

  const tabId = stored[CAPTURE_TAB_ID_STORAGE_KEY]
  return typeof tabId === "number" ? tabId : null
}
