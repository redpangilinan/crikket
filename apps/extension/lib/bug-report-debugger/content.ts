import {
  isDebuggerContentBridgePayload,
  sendDebuggerPageEvent,
} from "./messaging"

export function setupDebuggerContentBridge(): void {
  if (typeof window === "undefined" || window.top !== window) {
    return
  }

  const onWindowMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window) return
    if (!isDebuggerContentBridgePayload(event.data)) return

    sendDebuggerPageEvent(event.data.event).catch(() => undefined)
  }

  window.addEventListener("message", onWindowMessage)
}
