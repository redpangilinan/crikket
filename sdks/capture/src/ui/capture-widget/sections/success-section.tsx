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
      </div>

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
    </section>
  )
}
