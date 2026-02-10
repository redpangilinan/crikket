import { reportNonFatalError } from "@crikket/shared/lib/errors"
import {
  BACKGROUND_LISTENER_FLAG,
  DISCARD_SESSION_MESSAGE,
  ENSURE_PAGE_RUNTIME_MESSAGE,
  GET_SESSION_SNAPSHOT_MESSAGE,
  MARK_RECORDING_STARTED_MESSAGE,
  PAGE_EVENT_MESSAGE,
  PAGE_EVENTS_MESSAGE,
  START_SESSION_MESSAGE,
} from "../../constants"
import { isDebuggerRuntimeMessage } from "../../messaging"
import type { DebuggerRuntimeResponse } from "../../types"
import { createDebuggerSessionStore } from "./session-store"

export function registerDebuggerBackgroundListeners(): void {
  const scope = globalThis as typeof globalThis & {
    [BACKGROUND_LISTENER_FLAG]?: boolean
  }

  if (scope[BACKGROUND_LISTENER_FLAG]) {
    return
  }

  scope[BACKGROUND_LISTENER_FLAG] = true

  const store = createDebuggerSessionStore()

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isDebuggerRuntimeMessage(message)) {
      return
    }

    const safeSendResponse = <TData>(
      response: DebuggerRuntimeResponse<TData>
    ) => {
      sendResponse(response)
    }

    const onError = (error: unknown) => {
      safeSendResponse({
        ok: false,
        error:
          error instanceof Error ? error.message : "Debugger handler failed",
      })
    }

    const handler = async () => {
      const tabId = sender.tab?.id
      const appendEventsForSenderTab = async (events: unknown[]) => {
        if (typeof tabId !== "number") {
          return
        }

        await store.appendPageEvents(tabId, events)
      }

      switch (message.type) {
        case START_SESSION_MESSAGE: {
          const data = await store.startSession(message.payload)
          safeSendResponse({ ok: true, data })
          return
        }
        case MARK_RECORDING_STARTED_MESSAGE: {
          await store.markSessionRecordingStarted(message.payload)
          safeSendResponse({ ok: true, data: undefined })
          return
        }
        case PAGE_EVENT_MESSAGE: {
          await appendEventsForSenderTab([message.payload.event])
          safeSendResponse({ ok: true, data: undefined })
          return
        }
        case PAGE_EVENTS_MESSAGE: {
          await appendEventsForSenderTab(message.payload.events)
          safeSendResponse({ ok: true, data: undefined })
          return
        }
        case ENSURE_PAGE_RUNTIME_MESSAGE: {
          if (typeof tabId === "number") {
            await store.injectDebuggerScriptForTab(tabId)
          }
          safeSendResponse({ ok: true, data: undefined })
          return
        }
        case GET_SESSION_SNAPSHOT_MESSAGE: {
          const data = await store.getSessionSnapshot(message.payload.sessionId)
          safeSendResponse({ ok: true, data })
          return
        }
        case DISCARD_SESSION_MESSAGE: {
          await store.discardSession(message.payload.sessionId)
          safeSendResponse({ ok: true, data: undefined })
          return
        }
        default: {
          safeSendResponse({ ok: true, data: undefined })
          return
        }
      }
    }

    handler().catch(onError)
    return true
  })

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const didTabNavigate =
      changeInfo.status === "loading" || typeof changeInfo.url === "string"

    if (!didTabNavigate) {
      return
    }

    const url =
      typeof changeInfo.url === "string"
        ? changeInfo.url
        : (tab.url ?? undefined)

    store.ensureDebuggerScriptForTab(tabId, url).catch((error: unknown) => {
      reportNonFatalError(
        `Failed to reinject debugger instrumentation after tab update for tab ${tabId}`,
        error
      )
    })
  })

  chrome.tabs.onRemoved.addListener((tabId) => {
    store.discardSessionByTabId(tabId).catch((error: unknown) => {
      reportNonFatalError(
        `Failed to discard debugger session for removed tab ${tabId}`,
        error
      )
    })
  })
}
