import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { cn } from "@crikket/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useState } from "react"
import { orpc } from "@/utils/orpc"

import { EmptyState, KeyValueSection, PayloadSection } from "./panel-sections"
import type { NetworkRequestDetailsProps } from "./types"
import {
  asKeyValueItems,
  DETAIL_SECTIONS,
  formatBody,
  getBodyParams,
  getQueryParams,
  safeParseUrl,
  statusTone,
} from "./utils"

const DETAIL_SECTION_VALUES = ["overview", "request", "response"] as const

export function NetworkRequestDetails({
  bugReportId,
  request,
}: NetworkRequestDetailsProps) {
  const [activeSection, setActiveSection] = useQueryState(
    "networkSection",
    parseAsStringLiteral(DETAIL_SECTION_VALUES).withDefault("overview")
  )
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const shouldLoadPayload =
    Boolean(request) &&
    (activeSection === "request" || activeSection === "response")

  const payloadQuery = useQuery(
    orpc.bugReport.getNetworkRequestPayload.queryOptions({
      input: {
        id: bugReportId,
        requestId: request?.id ?? "__pending_request__",
      },
      enabled: shouldLoadPayload,
      staleTime: Number.POSITIVE_INFINITY,
    })
  )

  if (!request) {
    return (
      <EmptyState message="Select a network request to inspect headers and payloads." />
    )
  }

  const requestBodyValue = payloadQuery.data?.requestBody ?? null
  const responseBodyValue = payloadQuery.data?.responseBody ?? null
  const parsedUrl = safeParseUrl(request.url)
  const queryParams = getQueryParams(request.url)
  const requestHeaders = asKeyValueItems(request.requestHeaders)
  const responseHeaders = asKeyValueItems(request.responseHeaders)
  const requestBodyPreview = formatBody(requestBodyValue)
  const responseBodyPreview = formatBody(responseBodyValue)
  const bodyParams = getBodyParams(requestBodyValue)
  const pathLabel = parsedUrl
    ? `${parsedUrl.pathname}${parsedUrl.search}`
    : request.url

  const onCopy = async (key: string, value: string | null | undefined) => {
    if (!(value && navigator.clipboard)) {
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)

      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current))
      }, 1400)
    } catch (error) {
      reportNonFatalError(
        "Failed to copy network request details value to clipboard",
        error
      )
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-background p-3">
        <div className="flex items-center gap-2">
          <span className="rounded border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
            {request.method.toUpperCase()}
          </span>
          {request.status !== null && (
            <span
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[11px]",
                statusTone(request.status)
              )}
            >
              {request.status}
            </span>
          )}
          {typeof request.duration === "number" && (
            <span className="rounded border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {request.duration}ms
            </span>
          )}
        </div>
        <p
          className="mt-2 break-all font-mono text-[11px] text-foreground"
          title={request.url}
        >
          {pathLabel}
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {parsedUrl?.origin ?? "Unknown origin"} •{" "}
          {new Date(request.timestamp).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg border bg-background p-1">
        {DETAIL_SECTIONS.map((section) => (
          <button
            className={cn(
              "rounded-md px-2 py-1.5 font-medium text-[11px] transition-colors",
              activeSection === section.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            key={section.id}
            onClick={() => {
              setActiveSection(section.id)
            }}
            type="button"
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === "overview" && (
        <div className="space-y-3">
          <KeyValueSection
            emptyMessage="No query parameters."
            items={queryParams}
            title="URL Query Params"
          />
          <KeyValueSection
            emptyMessage="No request headers captured."
            items={requestHeaders}
            title="Request Headers"
          />
          <KeyValueSection
            emptyMessage="No response headers captured."
            items={responseHeaders}
            title="Response Headers"
          />
        </div>
      )}

      {activeSection === "request" && (
        <div className="space-y-3">
          <KeyValueSection
            emptyMessage={
              payloadQuery.isLoading
                ? "Loading request body..."
                : "No structured params detected in request body."
            }
            items={bodyParams}
            title="Body Params"
          />
          <PayloadSection
            copied={copiedKey === "request-body"}
            emptyMessage={
              payloadQuery.isError
                ? "Could not load request body."
                : "No payload captured."
            }
            isLoading={payloadQuery.isLoading}
            onCopy={() => onCopy("request-body", requestBodyPreview?.raw)}
            payload={requestBodyPreview}
            title="Request Body"
          />
          <KeyValueSection
            emptyMessage="No request headers captured."
            items={requestHeaders}
            title="Request Headers"
          />
        </div>
      )}

      {activeSection === "response" && (
        <div className="space-y-3">
          <PayloadSection
            copied={copiedKey === "response-body"}
            emptyMessage={
              payloadQuery.isError
                ? "Could not load response body."
                : "No payload captured."
            }
            isLoading={payloadQuery.isLoading}
            onCopy={() => onCopy("response-body", responseBodyPreview?.raw)}
            payload={responseBodyPreview}
            title="Response Body"
          />
          <KeyValueSection
            emptyMessage="No response headers captured."
            items={responseHeaders}
            title="Response Headers"
          />
        </div>
      )}
    </div>
  )
}
