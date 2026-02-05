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
