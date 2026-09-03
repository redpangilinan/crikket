import type { CaptureLauncherPlacement } from "../../../types"
import { resolveLauncherPlacementVars } from "../../../utils"

export function CaptureLauncherButton(props: {
  disabled: boolean
  onClick: () => void
  zIndex: number
  placement?: CaptureLauncherPlacement
}): React.JSX.Element {
  return (
    <button
      aria-label="Report an issue"
      className="capture-launcher"
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        ["--capture-z-index" as string]: String(props.zIndex),
        ...resolveLauncherPlacementVars(props.placement),
      }}
      type="button"
    >
      Report Issue
    </button>
  )
}
