export interface FetchCaptureContext {
  method: string
  normalizedUrl: string
  requestHeaders: Record<string, string>
  requestContentType: string
  requestBodyPromise: Promise<string | undefined>
}
