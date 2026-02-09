export const DEBUGGER_SESSION_QUERY_PARAM = "debuggerSessionId"

export function appendDebuggerSessionIdToUrl(
  url: string,
  sessionId: string
): string {
  const parsedUrl = new URL(url)
  parsedUrl.searchParams.set(DEBUGGER_SESSION_QUERY_PARAM, sessionId)
  return parsedUrl.toString()
}

export function readDebuggerSessionIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search)
  const sessionId = params.get(DEBUGGER_SESSION_QUERY_PARAM)
  return sessionId && sessionId.trim().length > 0 ? sessionId : null
}
