import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useEffect, useRef } from "react"

interface UseHotkeyTriggerInput {
  storageKey: string
  enabled?: boolean
  onTrigger: () => Promise<void>
  errorMessage: string
}

export function useHotkeyTrigger({
  enabled = true,
  errorMessage,
  onTrigger,
  storageKey,
}: UseHotkeyTriggerInput): void {
  const isHandlingRef = useRef(false)

  useEffect(() => {
    if (!enabled || isHandlingRef.current) {
      return
    }

    let isCancelled = false

    const runTrigger = async () => {
      const stored = await chrome.storage.local.get([storageKey])
      const isTriggered = typeof stored[storageKey] === "number"
      if (!isTriggered) {
        return
      }

      isHandlingRef.current = true
      await chrome.storage.local.remove([storageKey])

      if (isCancelled) {
        return
      }

      await onTrigger()
    }

    runTrigger()
      .catch((error: unknown) => {
        reportNonFatalError(errorMessage, error)
      })
      .finally(() => {
        isHandlingRef.current = false
      })

    return () => {
      isCancelled = true
    }
  }, [enabled, errorMessage, onTrigger, storageKey])
}
