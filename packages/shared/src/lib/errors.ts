interface NonFatalErrorOptions {
  once?: boolean
}

const reportedContexts = new Set<string>()

export function reportNonFatalError(
  context: string,
  error: unknown,
  options?: NonFatalErrorOptions
): void {
  if (options?.once) {
    if (reportedContexts.has(context)) {
      return
    }

    reportedContexts.add(context)
  }

  console.warn(`[Non-fatal] ${context}`, error)
}

interface ErrorWithCode {
  code?: unknown
}

export function isErrorWithCode(
  error: unknown,
  code: string
): error is Error & ErrorWithCode {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as ErrorWithCode).code === code
  )
}
