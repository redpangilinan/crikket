import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useEffect, useState } from "react"
import {
  type CaptureContext,
  getActiveTabContext,
  hasCaptureContext,
  readAndClearStoredCaptureContext,
} from "@/lib/capture-context"

export function useCaptureContext(): CaptureContext {
  const [captureContext, setCaptureContext] = useState<CaptureContext>({})

  useEffect(() => {
    const loadCaptureContext = async () => {
      try {
        const storedCaptureContext = await readAndClearStoredCaptureContext()
        if (hasCaptureContext(storedCaptureContext)) {
          setCaptureContext(storedCaptureContext)
          return
        }

        const activeTabContext = await getActiveTabContext()
        setCaptureContext(activeTabContext)
      } catch (error) {
        reportNonFatalError("Failed to load capture context", error)
        setCaptureContext({})
      }
    }

    loadCaptureContext()
  }, [])

  return captureContext
}
