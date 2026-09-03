import type { CaptureLauncherPlacement } from "../../types"
import type { CaptureUiHandlers, CaptureUiState } from "../types"
import { CaptureWidgetView } from "./capture-widget-view"
import { CaptureLauncherButton } from "./components/capture-launcher-button"
import { Button } from "./components/primitives/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/primitives/card"
import { RecordingDock } from "./sections/recording-dock"
import { getViewDescription } from "./utils/get-view-description"

export function CaptureWidgetShell(props: {
  zIndex: number
  state: CaptureUiState
  handlers: CaptureUiHandlers
  isSubmitPending: boolean
  recordingTime: string
  launcherPlacement?: CaptureLauncherPlacement
}): React.JSX.Element {
  const isBusy = props.state.busy || props.isSubmitPending
  const isReviewView = props.state.view === "review"
  const isRecordingView = props.state.view === "recording"

  return (
    <div className="crikket-capture-root">
      {isRecordingView ? null : (
        <CaptureLauncherButton
          disabled={isBusy}
          onClick={props.handlers.onLauncherClick}
          placement={props.launcherPlacement}
          zIndex={props.zIndex}
        />
      )}

      {props.state.overlayOpen ? (
        <div
          className="fixed inset-0 z-[var(--capture-overlay-z-index)] grid overflow-y-auto bg-black/60 p-4"
          style={{
            ["--capture-overlay-z-index" as string]: String(props.zIndex + 1),
          }}
        >
          <Card
            className={
              isReviewView
                ? "m-auto flex h-[min(820px,calc(100dvh-2rem))] w-full max-w-[1120px] flex-col overflow-hidden border-border/80 bg-card text-card-foreground shadow-2xl"
                : "m-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[560px] flex-col overflow-hidden border-border/80 bg-card text-card-foreground shadow-2xl"
            }
            role="dialog"
          >
            <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
              <div className="grid gap-1">
                <CardTitle>Crikket Capture</CardTitle>
                <CardDescription>
                  {getViewDescription(props.state.view)}
                </CardDescription>
              </div>
              <Button
                disabled={isBusy}
                onClick={props.handlers.onClose}
                type="button"
                variant="outline"
              >
                Close
              </Button>
            </CardHeader>

            {props.state.errorMessage ? (
              <p
                className="mx-5 mt-5 rounded-md border bg-muted px-3 py-2 text-sm"
                role="alert"
              >
                {props.state.errorMessage}
              </p>
            ) : null}

            <CardContent
              className={
                isReviewView
                  ? "min-h-0 flex-1 overflow-hidden px-0 pb-0"
                  : "min-h-0 overflow-y-auto px-0 pb-0"
              }
            >
              <CaptureWidgetView
                handlers={props.handlers}
                isBusy={isBusy}
                isSubmitPending={props.isSubmitPending}
                state={props.state}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {props.state.recordingDockOpen ? (
        <RecordingDock
          busy={isBusy}
          onStopRecording={props.handlers.onStopRecording}
          recordingTime={props.recordingTime}
          zIndex={props.zIndex}
        />
      ) : null}
    </div>
  )
}
