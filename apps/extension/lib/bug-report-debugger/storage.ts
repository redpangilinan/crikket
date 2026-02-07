import { DEBUGGER_SESSION_ID_STORAGE_KEY } from "./constants"

export async function readStoredDebuggerSessionId(): Promise<string | null> {
  const result = await chrome.storage.local.get([
    DEBUGGER_SESSION_ID_STORAGE_KEY,
  ])
  const sessionId = result[DEBUGGER_SESSION_ID_STORAGE_KEY]

  return typeof sessionId === "string" && sessionId.length > 0
    ? sessionId
    : null
}

export async function storeDebuggerSessionId(
  sessionId: string | null
): Promise<void> {
  if (sessionId) {
    await chrome.storage.local.set({
      [DEBUGGER_SESSION_ID_STORAGE_KEY]: sessionId,
    })
    return
  }

  await chrome.storage.local.remove([DEBUGGER_SESSION_ID_STORAGE_KEY])
}
