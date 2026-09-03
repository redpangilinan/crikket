import { useSyncExternalStore } from "react"
import type { CaptureLauncherPlacement } from "../../types"
import type { CaptureUiCallbacks, CaptureUiStore } from "../types"
import { CaptureWidgetShell } from "./capture-widget-shell"
import { useCaptureUiHandlers } from "./hooks/use-capture-ui-handlers"
import { useRecordingClock } from "./hooks/use-recording-clock"

export function CaptureWidgetRoot(props: {
  callbacks: CaptureUiCallbacks
  store: CaptureUiStore
  zIndex: number
  launcherPlacement?: CaptureLauncherPlacement
}): React.JSX.Element {
  const state = useSyncExternalStore(
    props.store.subscribe,
    props.store.getSnapshot,
    props.store.getSnapshot
  )
  const { handlers, isSubmitPending } = useCaptureUiHandlers({
    callbacks: props.callbacks,
    shareUrl: state.shareUrl,
    store: props.store,
  })
  const recordingTime = useRecordingClock({
    recordingDockOpen: state.recordingDockOpen,
    recordingStartedAt: state.recordingStartedAt,
  })

  return (
    <CaptureWidgetShell
      handlers={handlers}
      isSubmitPending={isSubmitPending}
      launcherPlacement={props.launcherPlacement}
      recordingTime={recordingTime}
      state={state}
      zIndex={props.zIndex}
    />
  )
}
