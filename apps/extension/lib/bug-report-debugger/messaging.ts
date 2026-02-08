import { reportNonFatalError } from "@crikket/shared/lib/errors"
import {
  DISCARD_SESSION_MESSAGE,
  GET_SESSION_SNAPSHOT_MESSAGE,
  MARK_RECORDING_STARTED_MESSAGE,
  PAGE_BRIDGE_SOURCE,
  PAGE_EVENT_MESSAGE,
  START_SESSION_MESSAGE,
} from "./constants"
import { isRecordLike } from "./normalize"
import type {
  DebuggerContentBridgePayload,
  DebuggerRuntimeMessage,
  DebuggerRuntimeResponse,
} from "./types"

export function sendDebuggerMessage<TData>(
  message: DebuggerRuntimeMessage
): Promise<TData> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      message,
      (response: DebuggerRuntimeResponse<TData> | undefined) => {
        const runtimeError = chrome.runtime.lastError
        if (runtimeError) {
          reject(new Error(runtimeError.message))
          return
        }

        if (!response) {
          reject(new Error("Debugger service did not respond"))
          return
        }

        if (!response.ok) {
          reject(new Error(response.error))
          return
        }

        resolve(response.data)
      }
    )
  })
}

export async function sendDebuggerPageEvent(rawEvent: unknown): Promise<void> {
  try {
    await sendDebuggerMessage<undefined>({
      type: PAGE_EVENT_MESSAGE,
      payload: {
        event: rawEvent,
      },
    })
  } catch (error) {
    reportNonFatalError("Failed to send debugger page event", error)
  }
}

export function isDebuggerRuntimeMessage(
  value: unknown
): value is DebuggerRuntimeMessage {
  if (!isRecordLike(value)) return false

  const messageType = value.type
  if (typeof messageType !== "string") return false

  return (
    messageType === START_SESSION_MESSAGE ||
    messageType === MARK_RECORDING_STARTED_MESSAGE ||
    messageType === GET_SESSION_SNAPSHOT_MESSAGE ||
    messageType === DISCARD_SESSION_MESSAGE ||
    messageType === PAGE_EVENT_MESSAGE
  )
}

export function isDebuggerContentBridgePayload(
  value: unknown
): value is DebuggerContentBridgePayload {
  if (!isRecordLike(value)) return false

  return value.source === PAGE_BRIDGE_SOURCE && Object.hasOwn(value, "event")
}
