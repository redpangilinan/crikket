// Screen capture (getDisplayMedia) is a desktop-only web feature. iOS Safari
// does not define it at all, and Chrome/Firefox for Android define the API but
// always reject it — so feature detection alone ("getDisplayMedia" in
// mediaDevices) is not enough and would present a launcher that fails only at
// the moment of use. We therefore combine an API check with a coarse mobile
// check, and offer a file-upload capture path where display capture is not
// usable.

const MOBILE_UA_REGEX =
  /android|iphone|ipad|ipod|iemobile|blackberry|opera mini|mobile/i
const MACINTOSH_UA_REGEX = /Macintosh/

interface NavigatorUAData {
  mobile?: boolean
}

export function isLikelyMobileDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false
  }

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData })
    .userAgentData
  if (uaData && typeof uaData.mobile === "boolean") {
    return uaData.mobile
  }

  const userAgent = navigator.userAgent ?? ""
  if (MOBILE_UA_REGEX.test(userAgent)) {
    return true
  }

  // iPadOS Safari reports a desktop ("Macintosh") user agent but is touch-first
  // and has no working getDisplayMedia.
  const maxTouchPoints = navigator.maxTouchPoints ?? 0
  return MACINTOSH_UA_REGEX.test(userAgent) && maxTouchPoints > 1
}

export function supportsDisplayCapture(): boolean {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia
  ) {
    return false
  }

  return !isLikelyMobileDevice()
}
