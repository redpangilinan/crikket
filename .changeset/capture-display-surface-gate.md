---
"@crikket-io/capture": minor
---

Accept whatever display surface the reporter shares, instead of demanding a browser tab.

`captureScreenshot()` and `startDisplayRecording()` asserted that the stream's `displaySurface` was exactly `"browser"` and otherwise stopped every track and threw "Please choose the current browser tab". That assert can never pass outside Chromium: Firefox has no `displaySurface` member in `MediaTrackSettings` at all and forces non-privileged `getDisplayMedia` to a window/screen list, and WebKit only ever reports `"monitor"` or `"window"` because macOS's picker offers no tab. Desktop Firefox and desktop Safari users were therefore told to pick a tab their browser does not offer, and the widget re-opened the picker every time they tried — capture was unusable on both. It also fired in Chrome whenever someone deliberately picked a window, which the Screen Capture spec explicitly permits ("the user agent MUST still offer the user unlimited choice of any display surface"). `preferCurrentTab` and the `displaySurface` constraint are kept as the hints the spec intends, and the chooser now says plainly what is about to be captured before the picker opens.

`requestDisplayStream()` no longer catches a failed audio-enabled `getDisplayMedia` and silently calls it again without audio — cancelling the picker re-opened it immediately, so a cancel looked like a second prompt. Display audio capture is now feature-detected (`supportsDisplayAudioCapture()`), requested only where the engine implements it, and any rejection surfaces to the caller.
