import { useEffect } from "react"

/**
 * When the recorder enters the "ready" state (mic enabled, waiting for
 * a user gesture), check if the microphone permission is already granted.
 * If so, call `onStart` immediately so the recording auto-starts.
 *
 * Pass `enabled: false` when the recording still needs an explicit user
 * gesture regardless of permissions (e.g. picking a screen to record).
 */
export function useMicAutoStart(
  state: string,
  onStart: () => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled || state !== "ready") return

    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (result.state === "granted") {
          onStart()
        }
      })
      .catch(() => {
        // permissions API unavailable — stay on "ready", show the button
      })
  }, [enabled, state, onStart])
}
