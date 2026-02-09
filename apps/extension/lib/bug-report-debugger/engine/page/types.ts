export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug"

export interface Reporter {
  reportNonFatalError: (context: string, error: unknown) => void
}

export interface EventQueue {
  enqueueEvent: (event: unknown) => void
  flushEventQueue: () => void
}
