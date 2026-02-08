import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useCallback, useEffect, useState } from "react"
import {
  RECORDER_TAB_ID_STORAGE_KEY,
  RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
  RECORDING_IN_PROGRESS_STORAGE_KEY,
  RECORDING_STARTED_AT_STORAGE_KEY,
} from "@/lib/capture-context"

interface UsePopupRecordingStatusReturn {
  isRecordingInProgress: boolean
  recordingCountdown: number | null
  recordingDurationMs: number
  isStoppingFromPopup: boolean
  stopError: string | null
  stopFromPopup: () => Promise<void>
}

export function usePopupRecordingStatus(): UsePopupRecordingStatusReturn {
  const [isRecordingInProgress, setIsRecordingInProgress] = useState(false)
  const [recordingCountdown, setRecordingCountdown] = useState<number | null>(
    null
  )
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(
    null
  )
  const [recordingDurationMs, setRecordingDurationMs] = useState(0)
  const [recorderTabId, setRecorderTabId] = useState<number | null>(null)
  const [isStoppingFromPopup, setIsStoppingFromPopup] = useState(false)
  const [stopError, setStopError] = useState<string | null>(null)

  const clearRecordingState = useCallback(async () => {
    await chrome.storage.local.set({
      [RECORDING_IN_PROGRESS_STORAGE_KEY]: false,
    })
    await chrome.storage.local.remove([
      RECORDER_TAB_ID_STORAGE_KEY,
      RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
      RECORDING_STARTED_AT_STORAGE_KEY,
    ])
  }, [])

  useEffect(() => {
    let intervalId: number | undefined

    const updateCountdown = (endsAt?: number) => {
      if (typeof endsAt !== "number") {
        setRecordingCountdown(null)
        if (intervalId !== undefined) {
          window.clearInterval(intervalId)
          intervalId = undefined
        }
        return
      }

      const update = () => {
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
        setRecordingCountdown(remaining > 0 ? remaining : null)
        if (remaining <= 0 && intervalId !== undefined) {
          window.clearInterval(intervalId)
          intervalId = undefined
        }
      }

      update()
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
      }
      intervalId = window.setInterval(update, 250)
    }

    const readRecordingState = async () => {
      const result = await chrome.storage.local.get([
        RECORDING_IN_PROGRESS_STORAGE_KEY,
        RECORDER_TAB_ID_STORAGE_KEY,
        RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        RECORDING_STARTED_AT_STORAGE_KEY,
      ])

      const tabId = result[RECORDER_TAB_ID_STORAGE_KEY]
      const countdownEndsAt =
        typeof result[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY] === "number"
          ? (result[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY] as number)
          : null
      const startedAt = result[RECORDING_STARTED_AT_STORAGE_KEY]

      return {
        isRecording: Boolean(result[RECORDING_IN_PROGRESS_STORAGE_KEY]),
        storedTabId: typeof tabId === "number" ? tabId : null,
        countdownEndsAt,
        recordingStartedAtValue:
          typeof startedAt === "number" ? startedAt : null,
      }
    }

    const resolveRecorderTabId = async (
      storedTabId: number | null
    ): Promise<number | null> => {
      if (storedTabId !== null) {
        try {
          await chrome.tabs.get(storedTabId)
          return storedTabId
        } catch (error) {
          reportNonFatalError(
            `Failed to resolve stored recorder tab ${storedTabId}, falling back to query lookup`,
            error
          )
        }
      }

      const recorderTabs = await chrome.tabs.query({
        url: [chrome.runtime.getURL("/recorder.html*")],
      })
      const mostRecentRecorderTab = recorderTabs
        .filter((tab) => typeof tab.id === "number")
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
      return mostRecentRecorderTab?.id ?? null
    }

    const applyInactiveState = (countdownEndsAt: number | null) => {
      setIsRecordingInProgress(false)
      setRecorderTabId(null)
      setRecordingStartedAt(null)
      updateCountdown(countdownEndsAt ?? undefined)
    }

    const applyRecoveredState = async () => {
      await clearRecordingState()
      setIsRecordingInProgress(false)
      setRecorderTabId(null)
      setRecordingStartedAt(null)
      updateCountdown(undefined)
    }

    const syncRecordingState = async () => {
      const {
        isRecording,
        storedTabId,
        countdownEndsAt,
        recordingStartedAtValue,
      } = await readRecordingState()

      if (!isRecording) {
        applyInactiveState(countdownEndsAt)
        return
      }

      const resolvedRecorderTabId = await resolveRecorderTabId(storedTabId)
      const hasActiveCountdown =
        typeof countdownEndsAt === "number" && countdownEndsAt > Date.now()

      if (resolvedRecorderTabId === null && !hasActiveCountdown) {
        await applyRecoveredState()
        return
      }

      setIsRecordingInProgress(true)
      setRecorderTabId(resolvedRecorderTabId)
      setRecordingStartedAt(recordingStartedAtValue)
      updateCountdown(countdownEndsAt ?? undefined)
    }

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local") return
      if (
        !(
          changes[RECORDING_IN_PROGRESS_STORAGE_KEY] ||
          changes[RECORDER_TAB_ID_STORAGE_KEY] ||
          changes[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY] ||
          changes[RECORDING_STARTED_AT_STORAGE_KEY]
        )
      ) {
        return
      }
      syncRecordingState().catch((error: unknown) => {
        reportNonFatalError("Failed to sync popup recording state", error)
      })
    }

    syncRecordingState().catch((error: unknown) => {
      reportNonFatalError("Failed to initialize popup recording state", error)
    })
    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
      }
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [clearRecordingState])

  useEffect(() => {
    if (!(isRecordingInProgress && recordingStartedAt)) {
      setRecordingDurationMs(0)
      return
    }

    const updateDuration = () => {
      setRecordingDurationMs(Math.max(0, Date.now() - recordingStartedAt))
    }

    updateDuration()
    const intervalId = window.setInterval(updateDuration, 200)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isRecordingInProgress, recordingStartedAt])

  const stopFromPopup = useCallback(async () => {
    setIsStoppingFromPopup(true)
    setStopError(null)

    try {
      try {
        await chrome.runtime.sendMessage({ type: "STOP_RECORDING_FROM_POPUP" })
      } catch (error) {
        reportNonFatalError(
          "Failed to send STOP_RECORDING_FROM_POPUP message, continuing with tab-based resolution",
          error
        )
      }

      let targetRecorderTabId: number | null = recorderTabId

      if (targetRecorderTabId === null) {
        const stored = await chrome.storage.local.get([
          RECORDER_TAB_ID_STORAGE_KEY,
        ])
        const storedTabId = stored[RECORDER_TAB_ID_STORAGE_KEY]
        targetRecorderTabId =
          typeof storedTabId === "number" ? storedTabId : null
      }

      if (targetRecorderTabId === null) {
        const recorderTabs = await chrome.tabs.query({
          url: [chrome.runtime.getURL("/recorder.html*")],
        })
        const mostRecentRecorderTab = recorderTabs
          .filter((tab) => typeof tab.id === "number")
          .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
        targetRecorderTabId = mostRecentRecorderTab?.id ?? null
      }

      if (targetRecorderTabId !== null) {
        const recorderTab = await chrome.tabs.get(targetRecorderTabId)
        if (typeof recorderTab.windowId === "number") {
          await chrome.windows.update(recorderTab.windowId, { focused: true })
        }
        await chrome.tabs.update(targetRecorderTabId, { active: true })
      } else {
        await clearRecordingState()
        setIsRecordingInProgress(false)
        setRecorderTabId(null)
        setRecordingStartedAt(null)
        setRecordingCountdown(null)
        setRecordingDurationMs(0)
      }

      window.close()
    } catch (err) {
      console.error(err)
      setStopError(
        err instanceof Error ? err.message : "Failed to stop recording"
      )
      setIsStoppingFromPopup(false)
    }
  }, [clearRecordingState, recorderTabId])

  return {
    isRecordingInProgress,
    recordingCountdown,
    recordingDurationMs,
    isStoppingFromPopup,
    stopError,
    stopFromPopup,
  }
}
