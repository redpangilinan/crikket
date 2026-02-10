import { MAX_BODY_LENGTH } from "../constants"
import { getRequestBodyPreview, shouldCaptureTextContent } from "../serializer"
import type { Reporter } from "../types"
import { sanitizeCapturedBody, truncate } from "../utils"

export const scheduleBackgroundTask = (
  reporter: Reporter,
  task: () => void | Promise<void>
): void => {
  const executeTask = () => {
    Promise.resolve(task()).catch((error: unknown) => {
      reporter.reportNonFatalError(
        "Background debugger instrumentation task failed",
        error
      )
    })
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => {
      executeTask()
    })
    return
  }

  window.setTimeout(executeTask, 0)
}

export const getRequestBodyPreviewAsync = (
  reporter: Reporter,
  body: unknown,
  stringifyValue: (value: unknown) => string,
  contentType = ""
): Promise<string | undefined> => {
  return new Promise((resolve) => {
    scheduleBackgroundTask(reporter, () => {
      resolve(
        sanitizeCapturedBody(
          getRequestBodyPreview(body, stringifyValue),
          contentType
        )
      )
    })
  })
}

export const getTextBodyPreviewAsync = (
  reporter: Reporter,
  contentType: string,
  errorContext: string,
  readBody: () => Promise<string>
): Promise<string | undefined> => {
  return new Promise((resolve) => {
    scheduleBackgroundTask(reporter, async () => {
      if (!shouldCaptureTextContent(contentType)) {
        resolve(undefined)
        return
      }

      try {
        resolve(
          sanitizeCapturedBody(
            truncate(await readBody(), MAX_BODY_LENGTH),
            contentType
          )
        )
      } catch (error) {
        reporter.reportNonFatalError(errorContext, error)
        resolve(undefined)
      }
    })
  })
}
