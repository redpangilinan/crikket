import { createRoot } from "react-dom/client"
import type { CaptureLauncherPlacement } from "../types"
import { CaptureWidgetRoot } from "./capture-widget/capture-widget-root"
import { createCaptureUiStore } from "./store/capture-ui-store"
import type { CaptureUiCallbacks, MountedCaptureUi } from "./types"

const CAPTURE_WIDGET_CSS_PLACEHOLDER = "__CRIKKET_CAPTURE_WIDGET_CSS__"

export function mountCaptureUi(
  target: HTMLElement,
  zIndex: number,
  callbacks: CaptureUiCallbacks,
  launcherPlacement?: CaptureLauncherPlacement
): MountedCaptureUi {
  const hostElement = document.createElement("div")
  const shadowRoot = hostElement.attachShadow({
    mode: "open",
  })
  const styleElement = document.createElement("style")
  styleElement.textContent = CAPTURE_WIDGET_CSS_PLACEHOLDER
  const container = document.createElement("div")
  shadowRoot.append(styleElement)
  shadowRoot.append(container)
  target.append(hostElement)

  const reactRoot = createRoot(container)
  const store = createCaptureUiStore()
  reactRoot.render(
    <CaptureWidgetRoot
      callbacks={callbacks}
      launcherPlacement={launcherPlacement}
      store={store}
      zIndex={zIndex}
    />
  )

  return {
    setHidden: (hidden) => {
      hostElement.style.display = hidden ? "none" : ""
    },
    store,
    unmount: () => {
      reactRoot.unmount()
      hostElement.remove()
      store.destroy()
    },
  }
}
