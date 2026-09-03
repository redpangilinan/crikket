---
"@crikket-io/capture": minor
---

Support capturing bug reports on mobile browsers.

Screen capture (`getDisplayMedia`) is a desktop-only web feature — iOS Safari does not define it and Android browsers define it but always reject it — so on mobile the launcher previously offered controls that threw at the moment of use. The widget now detects when display capture is not usable (an API check combined with a coarse mobile check that treats Android's defines-but-rejects behavior as unsupported) and offers an **Upload Screenshot** path instead, attaching an OS screenshot through the same review + submit pipeline. Console/network/URL/device context is still collected. Adds `attachScreenshotFile(file)` to drive this programmatically.
