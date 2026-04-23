import type { CaptureUiHandlers, CaptureUiState } from "../../types"
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "../components/icons"
import { Button } from "../components/primitives/button"
import { Input } from "../components/primitives/input"
import { Label } from "../components/primitives/label"

export function SuccessSection(props: {
  state: CaptureUiState
  handlers: CaptureUiHandlers
}): React.JSX.Element {
  const hasCopied = props.state.copyLabel === "Copied"

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
            aria-label={hasCopied ? "Copied" : "Copy link"}
            className="shrink-0"
            disabled={props.state.busy}
            onClick={props.handlers.onCopyLink}
            size="icon"
            type="button"
            variant="outline"
          >
            {hasCopied ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {props.state.githubIssueUrl ? (
        <div className="grid gap-2">
          <Label>GitHub Issue</Label>
          <a
            className="inline-flex items-center gap-1.5 text-sm underline underline-offset-2 hover:no-underline"
            href={props.state.githubIssueUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            {props.state.githubIssueUrl}
          </a>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          className="w-full gap-2"
          disabled={props.state.busy}
          onClick={props.handlers.onOpenLink}
          type="button"
          variant="outline"
        >
          <ExternalLinkIcon className="h-4 w-4" />
          Open Link
        </Button>
        <Button
          className="w-full gap-2"
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
