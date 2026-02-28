import type { CaptureUiHandlers, CaptureUiState } from "../../types"
import { Button } from "../components/primitives/button"
import { Input } from "../components/primitives/input"
import { Label } from "../components/primitives/label"

export function SuccessSection(props: {
  state: CaptureUiState
  handlers: CaptureUiHandlers
}): React.JSX.Element {
  return (
    <section className="grid gap-5 p-5">
      <div className="grid gap-1 text-center">
        <strong className="text-green-700 text-xl">Bug report submitted</strong>
        <p className="m-0 text-muted-foreground text-sm">
          Your bug report has been created successfully.
        </p>
      </div>

      <div className="grid gap-2">
        {props.state.shareUrl ? (
          <>
            <Label>Share URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="flex-1"
                readOnly
                type="text"
                value={props.state.shareUrl}
              />
              <Button
                className="shrink-0 sm:min-w-28"
                disabled={props.state.busy}
                onClick={props.handlers.onCopyLink}
                type="button"
                variant="outline"
              >
                {props.state.copyLabel}
              </Button>
            </div>
          </>
        ) : (
          <p className="m-0 rounded-lg border border-input bg-muted/40 px-3 py-3 text-muted-foreground text-sm">
            This report was submitted privately. Only your team can view it.
          </p>
        )}
      </div>

      {props.state.shareUrl ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            className="w-full"
            disabled={props.state.busy}
            onClick={props.handlers.onOpenLink}
            type="button"
            variant="outline"
          >
            Open Link
          </Button>
          <Button
            className="w-full"
            disabled={props.state.busy}
            onClick={props.handlers.onRetry}
            type="button"
          >
            Capture Another
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={props.state.busy}
          onClick={props.handlers.onRetry}
          type="button"
        >
          Capture Another
        </Button>
      )}
    </section>
  )
}
