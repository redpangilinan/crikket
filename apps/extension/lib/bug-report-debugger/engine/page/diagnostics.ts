import type { PageRuntimeDiagnostics, Reporter } from "./types"
import { truncate } from "./utils"

const DIAGNOSTICS_KEY = "__crikketDebuggerDiagnostics"
const DIAGNOSTICS_VERSION = 1
const MAX_ERROR_ENTRIES = 25
const MAX_ERROR_LENGTH = 300

type RuntimeScope = Window & {
  [DIAGNOSTICS_KEY]?: PageRuntimeDiagnostics
}

const createDefaultDiagnosticsState = (): PageRuntimeDiagnostics => {
  return {
    version: DIAGNOSTICS_VERSION,
    installedAt: Date.now(),
    url: location.href,
    hooks: {
      fetch: "pending",
      xhr: false,
    },
    counters: {
      actionEvents: 0,
      consoleEvents: 0,
      networkEvents: 0,
      fetchCalls: 0,
      fetchFailures: 0,
      xhrCalls: 0,
      queuedEvents: 0,
      flushedBatches: 0,
    },
    last: {},
    errors: [],
  }
}

const toErrorMessage = (context: string, error: unknown): string => {
  if (error instanceof Error) {
    return `${context}: ${error.message}`
  }

  return `${context}: ${String(error)}`
}

export interface PageDiagnostics {
  readonly state: PageRuntimeDiagnostics
  createReporter: (reporter: Reporter) => Reporter
  recordActionEvent: () => void
  recordConsoleEvent: () => void
  recordNetworkEvent: (url: string) => void
  recordFetchCall: () => void
  recordFetchFailure: (message: string) => void
  setFetchHookState: (state: PageRuntimeDiagnostics["hooks"]["fetch"]) => void
  recordXhrCall: () => void
  setXhrHookInstalled: () => void
  recordQueuedEvent: () => void
  recordFlushedBatch: () => void
}

export function createPageDiagnostics(scope: Window): PageDiagnostics {
  const runtimeScope = scope as RuntimeScope
  const state = runtimeScope[DIAGNOSTICS_KEY] ?? createDefaultDiagnosticsState()

  runtimeScope[DIAGNOSTICS_KEY] = state
  state.installedAt = Date.now()
  state.url = location.href
  state.hooks.fetch = "pending"
  state.hooks.xhr = false

  return {
    state,
    createReporter(reporter: Reporter): Reporter {
      const originalReport = reporter.reportNonFatalError.bind(reporter)
      return {
        reportNonFatalError(context: string, error: unknown): void {
          state.errors.push(
            truncate(toErrorMessage(context, error), MAX_ERROR_LENGTH)
          )
          if (state.errors.length > MAX_ERROR_ENTRIES) {
            state.errors.shift()
          }

          originalReport(context, error)
        },
      }
    },
    recordActionEvent(): void {
      state.counters.actionEvents += 1
    },
    recordConsoleEvent(): void {
      state.counters.consoleEvents += 1
    },
    recordNetworkEvent(url: string): void {
      state.counters.networkEvents += 1
      state.last.networkUrl = url
    },
    recordFetchCall(): void {
      state.counters.fetchCalls += 1
    },
    recordFetchFailure(message: string): void {
      state.counters.fetchFailures += 1
      state.last.fetchError = message
    },
    setFetchHookState(nextState): void {
      state.hooks.fetch = nextState
    },
    recordXhrCall(): void {
      state.counters.xhrCalls += 1
    },
    setXhrHookInstalled(): void {
      state.hooks.xhr = true
    },
    recordQueuedEvent(): void {
      state.counters.queuedEvents += 1
    },
    recordFlushedBatch(): void {
      state.counters.flushedBatches += 1
    },
  }
}
