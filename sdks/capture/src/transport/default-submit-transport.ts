import type { CaptureSubmitRequest, CaptureSubmitResult } from "../types"
import { runTurnstileChallenge } from "./turnstile"

const ABSOLUTE_HTTP_URL_REGEX = /^https?:\/\//
const BUG_REPORTS_PATH_SUFFIX = "/bug-reports"
const CAPTURE_CHALLENGE_REQUIRED_CODE = "CAPTURE_CHALLENGE_REQUIRED"

export async function defaultSubmitTransport(
  request: CaptureSubmitRequest
): Promise<CaptureSubmitResult> {
  const submitUrl = `${request.config.host}${request.config.submitPath}`
  const submitToken = await fetchCaptureSubmitToken(request)
  const formData = new FormData()

  formData.set("title", request.report.title)
  formData.set("description", request.report.description)
  formData.set("priority", request.report.priority)
  formData.set("visibility", request.report.visibility)
  formData.set("captureType", request.report.captureType)
  formData.set("pageUrl", request.report.pageUrl)
  formData.set("pageTitle", request.report.pageTitle)
  formData.set("sdkVersion", request.report.sdkVersion)
  formData.set("durationMs", String(request.report.durationMs ?? ""))
  formData.set("deviceInfo", JSON.stringify(request.report.deviceInfo ?? {}))
  formData.set(
    "debuggerSummary",
    JSON.stringify(request.report.debuggerSummary)
  )
  formData.set(
    "debuggerPayload",
    JSON.stringify(request.report.debuggerPayload ?? null)
  )
  formData.set(
    "capture",
    request.report.media,
    request.report.captureType === "screenshot" ? "capture.png" : "capture.webm"
  )

  const response = await fetch(submitUrl, {
    method: "POST",
    headers: {
      ...(submitToken ? { "x-crikket-capture-token": submitToken } : undefined),
      "x-crikket-public-key": request.config.key,
    },
    body: formData,
    credentials: "omit",
    mode: "cors",
  })

  const responsePayload = await parseResponsePayload(response)
  if (!response.ok) {
    throw new Error(getResponseErrorMessage(responsePayload, response.status))
  }

  return {
    shareUrl: resolveShareUrl(
      request.config.host,
      resolveString(responsePayload, ["shareUrl", "url"])
    ),
    reportId: resolveString(responsePayload, ["id", "reportId"]),
    raw: responsePayload,
  }
}

async function fetchCaptureSubmitToken(
  request: CaptureSubmitRequest
): Promise<string | undefined> {
  const tokenUrl = `${request.config.host}${resolveCaptureTokenPath(
    request.config.submitPath
  )}`
  let turnstileToken: string | undefined

  for (const _attempt of [0, 1] as const) {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-crikket-public-key": request.config.key,
      },
      body: JSON.stringify(
        turnstileToken ? { turnstileToken } : { turnstileToken: undefined }
      ),
      credentials: "omit",
      mode: "cors",
    })

    if (
      response.status === 404 ||
      response.status === 405 ||
      response.status === 501
    ) {
      return undefined
    }

    const responsePayload = await parseResponsePayload(response)
    if (response.ok) {
      return resolveString(responsePayload, ["token"])
    }

    const challenge = resolveChallenge(responsePayload)
    if (
      isChallengeRequired(responsePayload) &&
      challenge?.provider === "turnstile" &&
      challenge.siteKey &&
      !turnstileToken
    ) {
      turnstileToken = await runTurnstileChallenge(challenge.siteKey)
      continue
    }

    throw new Error(getResponseErrorMessage(responsePayload, response.status))
  }

  throw new Error("Anti-bot verification could not be completed.")
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    return undefined
  }

  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function getResponseErrorMessage(payload: unknown, status: number): string {
  if (!isRecord(payload)) {
    return `Capture submission failed with status ${status}.`
  }

  const message = resolveString(payload, ["message", "error"])
  return message ?? `Capture submission failed with status ${status}.`
}

function isChallengeRequired(payload: unknown): boolean {
  return isRecord(payload) && payload.code === CAPTURE_CHALLENGE_REQUIRED_CODE
}

function resolveChallenge(
  payload: unknown
): { provider?: string; siteKey?: string } | undefined {
  if (!isRecord(payload)) {
    return undefined
  }

  const challenge = payload.challenge
  if (!isRecord(challenge)) {
    return undefined
  }

  return {
    provider:
      typeof challenge.provider === "string" ? challenge.provider : undefined,
    siteKey:
      typeof challenge.siteKey === "string" ? challenge.siteKey : undefined,
  }
}

function resolveString(
  payload: unknown,
  keys: readonly string[]
): string | undefined {
  if (!isRecord(payload)) {
    return undefined
  }

  for (const key of keys) {
    const candidate = payload[key]
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate
    }
  }

  const nestedReport = payload.report
  if (!isRecord(nestedReport)) {
    return undefined
  }

  for (const key of keys) {
    const candidate = nestedReport[key]
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate
    }
  }

  return undefined
}

function resolveShareUrl(
  host: string,
  shareUrl: string | undefined
): string | undefined {
  if (!shareUrl) {
    return undefined
  }

  if (ABSOLUTE_HTTP_URL_REGEX.test(shareUrl)) {
    return shareUrl
  }

  return `${host}${shareUrl.startsWith("/") ? shareUrl : `/${shareUrl}`}`
}

function resolveCaptureTokenPath(submitPath: string): string {
  const normalizedSubmitPath = submitPath.endsWith("/")
    ? submitPath.slice(0, -1)
    : submitPath

  if (normalizedSubmitPath.endsWith(BUG_REPORTS_PATH_SUFFIX)) {
    return `${normalizedSubmitPath.slice(0, -BUG_REPORTS_PATH_SUFFIX.length)}/capture-token`
  }

  return `${normalizedSubmitPath}/token`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
