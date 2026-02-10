import { createStringifyValue } from "../../serializer"
import { truncate } from "../../utils"
import type { NetworkCaptureInput } from "../types"
import {
  installRequestConstructorCapture,
  resolveFetchContext,
} from "./context"
import { scheduleFetchFailurePost, scheduleFetchSuccessPost } from "./post"

export const installFetchCapture = (input: NetworkCaptureInput): void => {
  const { diagnostics, postNetwork, reporter } = input
  const stringifyValue = createStringifyValue(reporter)
  const requestBodyByRequest = new WeakMap<
    Request,
    Promise<string | undefined>
  >()

  const bindFetch = (candidate: typeof window.fetch): typeof window.fetch => {
    return candidate.bind(window) as typeof window.fetch
  }

  installRequestConstructorCapture(
    reporter,
    stringifyValue,
    requestBodyByRequest
  )

  if (typeof window.fetch !== "function") {
    diagnostics.setFetchHookState("failed")
    return
  }

  const baseFetch = bindFetch(window.fetch)
  let delegateFetch = baseFetch
  let isInsidePatchedFetch = false

  const patchedFetch = (async (...args: Parameters<typeof window.fetch>) => {
    if (isInsidePatchedFetch) {
      // Prevent recursion when third-party fetch wrappers call window.fetch().
      return baseFetch(...args)
    }

    isInsidePatchedFetch = true
    diagnostics.recordFetchCall()
    const startedAt = Date.now()
    const context = resolveFetchContext(
      args,
      reporter,
      stringifyValue,
      requestBodyByRequest
    )
    if (!context) {
      try {
        return delegateFetch(...args)
      } finally {
        isInsidePatchedFetch = false
      }
    }

    try {
      const response = await delegateFetch(...args)
      const duration = Date.now() - startedAt
      scheduleFetchSuccessPost(
        reporter,
        postNetwork,
        context,
        response,
        duration
      )
      return response
    } catch (error) {
      diagnostics.recordFetchFailure(truncate(stringifyValue(error), 300))
      scheduleFetchFailurePost(
        reporter,
        postNetwork,
        context,
        error,
        startedAt,
        stringifyValue
      )
      throw error
    } finally {
      isInsidePatchedFetch = false
    }
  }) as typeof window.fetch

  try {
    Object.assign(patchedFetch, window.fetch)
  } catch (error) {
    reporter.reportNonFatalError(
      "Failed to mirror fetch properties in debugger instrumentation",
      error
    )
  }

  const fetchDescriptor = Object.getOwnPropertyDescriptor(window, "fetch")
  const canRedefineFetch = !fetchDescriptor || fetchDescriptor.configurable

  if (canRedefineFetch) {
    try {
      Object.defineProperty(window, "fetch", {
        configurable: true,
        enumerable: fetchDescriptor?.enumerable ?? true,
        get() {
          return patchedFetch
        },
        set(nextFetch: unknown) {
          if (typeof nextFetch !== "function") {
            return
          }

          if (nextFetch === patchedFetch) {
            return
          }

          delegateFetch = bindFetch(nextFetch as typeof window.fetch)
        },
      })
      diagnostics.setFetchHookState("accessor")
      return
    } catch (error) {
      reporter.reportNonFatalError(
        "Failed to install fetch accessor in debugger instrumentation",
        error
      )
    }
  }

  try {
    window.fetch = patchedFetch
    diagnostics.setFetchHookState("assignment")
  } catch (error) {
    diagnostics.setFetchHookState("failed")
    reporter.reportNonFatalError(
      "Failed to patch fetch in debugger instrumentation",
      error
    )
  }
}
