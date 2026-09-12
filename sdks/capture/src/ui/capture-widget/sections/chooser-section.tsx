import { useMemo } from "react"
import { supportsDisplayAudioCapture } from "../../../media/display-capture"
import { Button } from "../components/primitives/button"

export function ChooserSection(props: {
  busy: boolean
  onStartVideo: () => void
  onTakeScreenshot: () => void
}): React.JSX.Element {
  const capturesAudio = useMemo(() => supportsDisplayAudioCapture(), [])

  return (
    <section className="grid gap-4 p-5">
      <p className="m-0 text-muted-foreground text-sm">
        Choose how to capture the issue.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="w-full"
          disabled={props.busy}
          onClick={props.onStartVideo}
          type="button"
        >
          Record Video
        </Button>
        <Button
          className="w-full"
          disabled={props.busy}
          onClick={props.onTakeScreenshot}
          type="button"
          variant="outline"
        >
          Take Screenshot
        </Button>
      </div>
      <p className="m-0 text-muted-foreground text-xs">
        Your browser will ask what to share. Whatever you pick — this tab,
        another window, or a whole screen — is captured as you see it and
        attached to this report, so pick the one showing the problem and nothing
        private.
        {capturesAudio
          ? " Recording also captures the audio your browser is sharing."
          : ""}{" "}
        Nothing is captured until you choose.
      </p>
    </section>
  )
}
