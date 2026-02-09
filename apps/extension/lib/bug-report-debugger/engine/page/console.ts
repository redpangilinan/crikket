import type { ConsoleLevel, Reporter } from "./types"

interface ConsoleCaptureInput {
  reporter: Reporter
  postConsole: (level: ConsoleLevel, args: unknown[]) => void
}

export function installConsoleCapture(input: ConsoleCaptureInput): void {
  const { reporter, postConsole } = input

  const consoleLevels: ConsoleLevel[] = [
    "log",
    "info",
    "warn",
    "error",
    "debug",
  ]

  for (const level of consoleLevels) {
    const original = console[level].bind(console)

    console[level] = (...args: unknown[]) => {
      try {
        postConsole(level, args)
      } catch (error) {
        reporter.reportNonFatalError(
          "Failed to post console event in debugger instrumentation",
          error
        )
      }

      original(...args)
    }
  }
}
