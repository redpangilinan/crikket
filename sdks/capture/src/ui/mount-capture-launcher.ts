import type { CaptureLauncherPlacement } from "../types"
import { resolveLauncherPlacementVars } from "../utils"

interface MountedCaptureLauncher {
  setLoading: (loading: boolean) => void
  unmount: () => void
}

interface MountCaptureLauncherOptions {
  zIndex: number
  onOpen: () => void
  onPrefetch: () => void
  placement?: CaptureLauncherPlacement
}

const CAPTURE_LAUNCHER_CSS_PLACEHOLDER = "__CRIKKET_CAPTURE_LAUNCHER_CSS__"

export function mountCaptureLauncher(
  target: HTMLElement,
  options: MountCaptureLauncherOptions
): MountedCaptureLauncher {
  const hostElement = document.createElement("div")
  const shadowRoot = hostElement.attachShadow({
    mode: "open",
  })
  const styleElement = document.createElement("style")
  styleElement.textContent = CAPTURE_LAUNCHER_CSS_PLACEHOLDER

  const button = document.createElement("button")
  button.className = "capture-launcher"
  button.style.setProperty("--capture-z-index", String(options.zIndex))
  for (const [name, value] of Object.entries(
    resolveLauncherPlacementVars(options.placement)
  )) {
    button.style.setProperty(name, value)
  }
  button.type = "button"
  button.textContent = "Report Issue"
  button.setAttribute("aria-label", "Report an issue")

  button.addEventListener("click", options.onOpen)
  button.addEventListener("pointerenter", options.onPrefetch, {
    once: true,
    passive: true,
  })
  button.addEventListener("focus", options.onPrefetch, {
    once: true,
    passive: true,
  })

  shadowRoot.append(styleElement, button)
  target.append(hostElement)

  return {
    setLoading: (loading) => {
      button.disabled = loading
      button.textContent = loading ? "Loading..." : "Report Issue"
    },
    unmount: () => {
      button.removeEventListener("click", options.onOpen)
      hostElement.remove()
    },
  }
}
