import { cn } from "@crikket/ui/lib/utils"
import { useState } from "react"

import { EmptyState, KeyValueSection, PayloadSection } from "./panel-sections"
import type { DetailSection, NetworkRequestDetailsProps } from "./types"
import {
  asKeyValueItems,
  DETAIL_SECTIONS,
  formatBody,
  getBodyParams,
  getQueryParams,
  safeParseUrl,
  statusTone,
} from "./utils"

export function NetworkRequestDetails({ request }: NetworkRequestDetailsProps) {
  const [activeSection, setActiveSection] = useState<DetailSection>("overview")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  if (!request) {
    return (
      <EmptyState message="Select a network request to inspect headers and payloads." />
    )
  }

  const parsedUrl = safeParseUrl(request.url)
  const queryParams = getQueryParams(request.url)
  const requestHeaders = asKeyValueItems(request.requestHeaders)
  const responseHeaders = asKeyValueItems(request.responseHeaders)
  const requestBodyPreview = formatBody(request.requestBody)
  const responseBodyPreview = formatBody(request.responseBody)
  const bodyParams = getBodyParams(request.requestBody)
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
    } catch {
      // Ignore clipboard errors to keep the inspector interactive.
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
            onClick={() => setActiveSection(section.id)}
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
            emptyMessage="No structured params detected in request body."
            items={bodyParams}
            title="Body Params"
          />
          <PayloadSection
            copied={copiedKey === "request-body"}
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
