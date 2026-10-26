/**
 * Get device info for the current browser
 */
export function getDeviceInfo() {
  return {
    browser: navigator.userAgent,
    os: navigator.platform,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  }
}

/**
 * Format duration in milliseconds to MM:SS
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
}

/**
 * Bring the extension page running this code to the front of its window
 */
export async function focusCurrentTab(): Promise<void> {
  const currentTab = await chrome.tabs.getCurrent()
  if (typeof currentTab?.id !== "number") return

  await chrome.windows.update(currentTab.windowId, { focused: true })
  await chrome.tabs.update(currentTab.id, { active: true })
}
