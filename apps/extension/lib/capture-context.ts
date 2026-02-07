export type CaptureContext = { title?: string; url?: string }

export const CAPTURE_CONTEXT_STORAGE_KEY = "captureContext"

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
