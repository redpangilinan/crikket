---
"@crikket-io/capture": minor
---

Add launcher placement + lifecycle hooks, and keep the recording dock reachable.

- **Launcher placement:** new `launcher` option (`{ position, offset }`, where `position` is `bottom-right` (default) / `bottom-left` / `top-right` / `top-left`) lets a host position the launcher without injecting CSS into the widget's shadow tree — CSS that was silently discarded when the runtime swapped its shadow host on first press.
- **Lifecycle hooks:** new `onOpen`/`onClose` options and an `isOpen()` method, so a host can pause its own keyboard shortcuts while a report is being typed instead of reaching into private markup.
- **Recording dock reachable:** the widget host is revealed again once recording is live, so the recording dock's Stop control is no longer hidden for the duration of the recording.
