import { useEffect, useState } from "react"
import { MICROPHONE_ENABLED_STORAGE_KEY } from "@/lib/capture-context"

/**
 * Loads the stored microphone preference once and exposes it as local state.
 */
export function useMicrophonePreference(): [
  boolean,
  (enabled: boolean) => void,
] {
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false)

  useEffect(() => {
    chrome.storage.local
      .get([MICROPHONE_ENABLED_STORAGE_KEY])
      .then((result) => {
        const stored = result[MICROPHONE_ENABLED_STORAGE_KEY]
        if (typeof stored === "boolean") {
          setMicrophoneEnabled(stored)
        }
      })
      .catch(() => undefined)
  }, [])

  return [microphoneEnabled, setMicrophoneEnabled]
}
