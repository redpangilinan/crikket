---
"@crikket-io/capture": minor
---

Capture network/console activity from page load, not just from when the widget is opened.

The network/console recorder previously installed only when a capture was started (button press), so requests made before that were never recorded and most screenshot reports said "No network requests were captured." The recorder now installs at `init()` by default and buffers events, and the buffered collector is handed to the eager runtime so nothing is lost across the lazy→eager handoff. A screenshot then replays the full retained window instead of only the short post-install lookback.

Opt out with `collectDebuggerEagerly: false` to restore installing the recorder on first capture.
