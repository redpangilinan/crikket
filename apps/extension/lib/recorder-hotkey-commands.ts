import { reportNonFatalError } from "@crikket/shared/lib/errors"
import {
  HOTKEY_START_SCREENSHOT_CAPTURE_STORAGE_KEY,
  HOTKEY_START_VIDEO_CAPTURE_STORAGE_KEY,
  RECORDER_TAB_ID_STORAGE_KEY,
  RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
  RECORDING_IN_PROGRESS_STORAGE_KEY,
  RECORDING_STARTED_AT_STORAGE_KEY,
} from "@/lib/capture-context"

export const START_RECORDING_COMMAND = "start-video-recording"
export const START_SCREENSHOT_COMMAND = "start-screenshot-capture"
export const STOP_RECORDING_COMMAND = "stop-video-recording"

export async function handleStartRecordingFromHotkey(): Promise<void> {
  await queueCaptureStartFromHotkey(HOTKEY_START_VIDEO_CAPTURE_STORAGE_KEY)
}

export async function handleStartScreenshotFromHotkey(): Promise<void> {
  await queueCaptureStartFromHotkey(HOTKEY_START_SCREENSHOT_CAPTURE_STORAGE_KEY)
}

async function queueCaptureStartFromHotkey(storageKey: string): Promise<void> {
  const state = await readRecordingState()
  if (state.isRecordingInProgress) {
    const recorderTabId = await resolveRecorderTabId()
    if (recorderTabId !== null) {
      await focusRecorderTab()
      return
    }

    await clearStaleRecordingState()
  }

  await chrome.storage.local.set({
    [storageKey]: Date.now(),
  })
  await chrome.action.openPopup()
}

export async function handleStopRecordingFromHotkey(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "STOP_RECORDING_FROM_POPUP" })
  } catch (error: unknown) {
    reportNonFatalError(
      "Failed to send STOP_RECORDING_FROM_POPUP for hotkey stop",
      error
    )
  }

  await focusRecorderTab()
}

export async function handleRecorderHotkeyCommand(
  command: string
): Promise<void> {
  if (command === START_RECORDING_COMMAND) {
    await handleStartRecordingFromHotkey()
    return
  }

  if (command === START_SCREENSHOT_COMMAND) {
    await handleStartScreenshotFromHotkey()
    return
  }

  if (command === STOP_RECORDING_COMMAND) {
    await handleStopRecordingFromHotkey()
  }
}

async function readRecordingState(): Promise<{
  isRecordingInProgress: boolean
}> {
  const result = await chrome.storage.local.get([
    RECORDING_IN_PROGRESS_STORAGE_KEY,
  ])
  return {
    isRecordingInProgress: Boolean(result[RECORDING_IN_PROGRESS_STORAGE_KEY]),
  }
}

async function focusRecorderTab(): Promise<void> {
  const recorderTabId = await resolveRecorderTabId()
  if (recorderTabId === null) {
    return
  }

  const recorderTab = await chrome.tabs.get(recorderTabId)
  if (typeof recorderTab.windowId === "number") {
    await chrome.windows.update(recorderTab.windowId, { focused: true })
  }
  await chrome.tabs.update(recorderTabId, { active: true })
}

async function resolveRecorderTabId(): Promise<number | null> {
  const stored = await chrome.storage.local.get([RECORDER_TAB_ID_STORAGE_KEY])
  const storedTabId = stored[RECORDER_TAB_ID_STORAGE_KEY]
  if (typeof storedTabId === "number") {
    try {
      await chrome.tabs.get(storedTabId)
      return storedTabId
    } catch (error: unknown) {
      reportNonFatalError(
        `Failed to resolve stored recorder tab ${storedTabId} from hotkey flow`,
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

async function clearStaleRecordingState(): Promise<void> {
  await chrome.storage.local.set({
    [RECORDING_IN_PROGRESS_STORAGE_KEY]: false,
  })
  await chrome.storage.local.remove([
    RECORDER_TAB_ID_STORAGE_KEY,
    RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
    RECORDING_STARTED_AT_STORAGE_KEY,
  ])
}
