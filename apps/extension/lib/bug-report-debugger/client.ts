import {
  DISCARD_SESSION_MESSAGE,
  GET_SESSION_SNAPSHOT_MESSAGE,
  MARK_RECORDING_STARTED_MESSAGE,
  START_SESSION_MESSAGE,
} from "./constants"
import { sendDebuggerMessage } from "./messaging"
import type { DebuggerCaptureType, DebuggerSessionSnapshot } from "./types"

export function startDebuggerSession(input: {
  captureTabId: number
  captureType: DebuggerCaptureType
}): Promise<{ sessionId: string; startedAt: number }> {
  return sendDebuggerMessage<{ sessionId: string; startedAt: number }>({
    type: START_SESSION_MESSAGE,
    payload: input,
  })
}

export async function markDebuggerRecordingStarted(input: {
  sessionId: string
  recordingStartedAt: number
}): Promise<void> {
  await sendDebuggerMessage<undefined>({
    type: MARK_RECORDING_STARTED_MESSAGE,
    payload: input,
  })
}

export function getDebuggerSessionSnapshot(
  sessionId: string
): Promise<DebuggerSessionSnapshot | null> {
  return sendDebuggerMessage<DebuggerSessionSnapshot | null>({
    type: GET_SESSION_SNAPSHOT_MESSAGE,
    payload: { sessionId },
  })
}

export async function discardDebuggerSession(sessionId: string): Promise<void> {
  await sendDebuggerMessage<undefined>({
    type: DISCARD_SESSION_MESSAGE,
    payload: { sessionId },
  })
}
