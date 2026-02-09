import { installActionAndNavigationCapture } from "./actions"
import { installConsoleCapture } from "./console"
import { INSTALL_FLAG } from "./constants"
import { createEventQueue } from "./event-queue"
import { installNetworkCapture } from "./network"
import { createStringifyValue } from "./serializer"
import type { ConsoleLevel } from "./types"
import { createNonFatalReporter, truncate } from "./utils"

export function installDebuggerPageRuntime(): void {
  const scope = window as Window & {
    [INSTALL_FLAG]?: boolean
  }

  if (scope[INSTALL_FLAG]) {
    return
  }

  scope[INSTALL_FLAG] = true

  const reporter = createNonFatalReporter()
  const { enqueueEvent, flushEventQueue } = createEventQueue()
  const stringifyValue = createStringifyValue(reporter)

  const postAction = (
    actionType: string,
    target: string | undefined,
    metadata?: Record<string, unknown>
  ) => {
    enqueueEvent({
      kind: "action",
      timestamp: Date.now(),
      actionType,
      target,
      metadata,
    })
  }

  const postConsole = (level: ConsoleLevel, args: unknown[]) => {
    const serializedArgs: string[] = []
    for (const arg of args) {
      serializedArgs.push(stringifyValue(arg))
    }

    enqueueEvent({
      kind: "console",
      timestamp: Date.now(),
      level,
      message: truncate(serializedArgs.join(" ")),
      metadata: {
        argumentCount: args.length,
      },
    })
  }

  const postNetwork = (payload: {
    method: string
    url: string
    status?: number
    duration?: number
    requestHeaders?: Record<string, string>
    responseHeaders?: Record<string, string>
    requestBody?: string
    responseBody?: string
  }) => {
    enqueueEvent({
      kind: "network",
      timestamp: Date.now(),
      ...payload,
    })
  }

  installActionAndNavigationCapture({
    postAction,
  })

  installConsoleCapture({
    reporter,
    postConsole,
  })

  installNetworkCapture({
    reporter,
    postNetwork,
  })

  const flushOnPageHide = () => {
    flushEventQueue()
  }

  window.addEventListener("pagehide", flushOnPageHide, {
    capture: true,
  })

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") {
        flushEventQueue()
      }
    },
    {
      capture: true,
      passive: true,
    }
  )
}
