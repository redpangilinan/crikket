import { db } from "@crikket/db"
import {
  bugReportAction,
  bugReportLog,
  bugReportNetworkRequest,
} from "@crikket/db/schema/bug-report"
import { and, asc, count, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

const MAX_DEBUGGER_ITEMS_PER_KIND = 2000
const MAX_OFFSET_MS = 24 * 60 * 60 * 1000

const debuggerMetadataSchema = z.record(z.string(), z.unknown()).optional()
const debuggerHeadersSchema = z.record(z.string(), z.string()).optional()

const debuggerActionSchema = z.object({
  type: z.string().min(1).max(80),
  target: z.string().max(1000).optional(),
  timestamp: z.string().datetime({ offset: true }),
  offset: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_OFFSET_MS)
    .nullable()
    .optional(),
  metadata: debuggerMetadataSchema,
})

const debuggerLogSchema = z.object({
  level: z.enum(["log", "info", "warn", "error", "debug"]),
  message: z.string().min(1).max(4000),
  timestamp: z.string().datetime({ offset: true }),
  offset: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_OFFSET_MS)
    .nullable()
    .optional(),
  metadata: debuggerMetadataSchema,
})

const debuggerNetworkRequestSchema = z.object({
  method: z.string().min(1).max(20),
  url: z.string().min(1).max(4096),
  status: z.number().int().nonnegative().max(999).optional(),
  duration: z.number().int().nonnegative().max(MAX_OFFSET_MS).optional(),
  requestHeaders: debuggerHeadersSchema,
  responseHeaders: debuggerHeadersSchema,
  requestBody: z.string().max(8000).optional(),
  responseBody: z.string().max(8000).optional(),
  timestamp: z.string().datetime({ offset: true }),
  offset: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_OFFSET_MS)
    .nullable()
    .optional(),
})

export const bugReportDebuggerInputSchema = z
  .object({
    actions: z
      .array(debuggerActionSchema)
      .max(MAX_DEBUGGER_ITEMS_PER_KIND)
      .default([]),
    logs: z
      .array(debuggerLogSchema)
      .max(MAX_DEBUGGER_ITEMS_PER_KIND)
      .default([]),
    networkRequests: z
      .array(debuggerNetworkRequestSchema)
      .max(MAX_DEBUGGER_ITEMS_PER_KIND)
      .default([]),
  })
  .optional()

export type BugReportDebuggerInput = z.infer<
  typeof bugReportDebuggerInputSchema
>

export interface BugReportDebuggerEventsData {
  actions: Array<{
    id: string
    type: string
    target: string | null
    timestamp: string
    offset: number | null
    metadata: Record<string, unknown> | null
  }>
  logs: Array<{
    id: string
    level: string
    message: string
    timestamp: string
    offset: number | null
    metadata: Record<string, unknown> | null
  }>
}

export interface BugReportNetworkRequestListItem {
  id: string
  method: string
  url: string
  status: number | null
  duration: number | null
  requestHeaders: Record<string, string> | null
  responseHeaders: Record<string, string> | null
  timestamp: string
  offset: number | null
}

export interface BugReportNetworkRequestPayload {
  requestBody: string | null
  responseBody: string | null
}

export interface BugReportNetworkRequestsPageInput {
  bugReportId: string
  limit: number
  offset: number
}

export interface BugReportNetworkRequestPayloadInput {
  bugReportId: string
  requestId: string
}

export async function countBugReportNetworkRequests(
  bugReportId: string
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(bugReportNetworkRequest)
    .where(eq(bugReportNetworkRequest.bugReportId, bugReportId))

  return result[0]?.value ?? 0
}

export async function getBugReportNetworkRequestsPage({
  bugReportId,
  limit,
  offset,
}: BugReportNetworkRequestsPageInput): Promise<
  BugReportNetworkRequestListItem[]
> {
  const networkRequests = await db
    .select({
      id: bugReportNetworkRequest.id,
      method: bugReportNetworkRequest.method,
      url: bugReportNetworkRequest.url,
      status: bugReportNetworkRequest.status,
      duration: bugReportNetworkRequest.duration,
      requestHeaders: bugReportNetworkRequest.requestHeaders,
      responseHeaders: bugReportNetworkRequest.responseHeaders,
      timestamp: bugReportNetworkRequest.timestamp,
      offset: bugReportNetworkRequest.offset,
    })
    .from(bugReportNetworkRequest)
    .where(eq(bugReportNetworkRequest.bugReportId, bugReportId))
    .orderBy(asc(bugReportNetworkRequest.timestamp))
    .limit(limit)
    .offset(offset)

  return networkRequests.map((request): BugReportNetworkRequestListItem => {
    return {
      id: request.id,
      method: request.method,
      url: request.url,
      status: request.status,
      duration: request.duration,
      requestHeaders: asStringRecord(request.requestHeaders),
      responseHeaders: asStringRecord(request.responseHeaders),
      timestamp: request.timestamp.toISOString(),
      offset: request.offset,
    }
  })
}

export async function getBugReportNetworkRequestPayload({
  bugReportId,
  requestId,
}: BugReportNetworkRequestPayloadInput): Promise<BugReportNetworkRequestPayload | null> {
  const [request] = await db
    .select({
      requestBody: bugReportNetworkRequest.requestBody,
      responseBody: bugReportNetworkRequest.responseBody,
    })
    .from(bugReportNetworkRequest)
    .where(
      and(
        eq(bugReportNetworkRequest.bugReportId, bugReportId),
        eq(bugReportNetworkRequest.id, requestId)
      )
    )
    .limit(1)

  if (!request) {
    return null
  }

  return {
    requestBody: request.requestBody,
    responseBody: request.responseBody,
  }
}

export async function persistBugReportDebuggerData(
  bugReportId: string,
  debuggerData: BugReportDebuggerInput
): Promise<void> {
  if (!debuggerData) {
    return
  }

  const normalized = bugReportDebuggerInputSchema.parse(debuggerData)
  if (!normalized) {
    return
  }

  const { actions, logs, networkRequests } = normalized

  if (actions.length > 0) {
    await db.insert(bugReportAction).values(
      actions.map((action) => ({
        id: nanoid(16),
        bugReportId,
        type: action.type,
        target: action.target,
        timestamp: new Date(action.timestamp),
        offset: normalizeOffset(action.offset),
        metadata: action.metadata,
      }))
    )
  }

  if (logs.length > 0) {
    await db.insert(bugReportLog).values(
      logs.map((log) => ({
        id: nanoid(16),
        bugReportId,
        level: log.level,
        message: log.message,
        timestamp: new Date(log.timestamp),
        offset: normalizeOffset(log.offset),
        metadata: log.metadata,
      }))
    )
  }

  if (networkRequests.length > 0) {
    await db.insert(bugReportNetworkRequest).values(
      networkRequests.map((request) => ({
        id: nanoid(16),
        bugReportId,
        method: request.method,
        url: request.url,
        status: request.status ?? null,
        duration: request.duration ?? null,
        requestHeaders: request.requestHeaders,
        responseHeaders: request.responseHeaders,
        requestBody: request.requestBody,
        responseBody: request.responseBody,
        timestamp: new Date(request.timestamp),
        offset: normalizeOffset(request.offset),
      }))
    )
  }
}

export async function getBugReportDebuggerEventsData(
  bugReportId: string
): Promise<BugReportDebuggerEventsData> {
  const [actions, logs] = await Promise.all([
    db
      .select({
        id: bugReportAction.id,
        type: bugReportAction.type,
        target: bugReportAction.target,
        timestamp: bugReportAction.timestamp,
        offset: bugReportAction.offset,
        metadata: bugReportAction.metadata,
      })
      .from(bugReportAction)
      .where(eq(bugReportAction.bugReportId, bugReportId))
      .orderBy(asc(bugReportAction.timestamp)),
    db
      .select({
        id: bugReportLog.id,
        level: bugReportLog.level,
        message: bugReportLog.message,
        timestamp: bugReportLog.timestamp,
        offset: bugReportLog.offset,
        metadata: bugReportLog.metadata,
      })
      .from(bugReportLog)
      .where(eq(bugReportLog.bugReportId, bugReportId))
      .orderBy(asc(bugReportLog.timestamp)),
  ])

  return {
    actions: actions.map((action) => ({
      id: action.id,
      type: action.type,
      target: action.target,
      timestamp: action.timestamp.toISOString(),
      offset: action.offset,
      metadata: asUnknownRecord(action.metadata),
    })),
    logs: logs.map((log) => ({
      id: log.id,
      level: log.level,
      message: log.message,
      timestamp: log.timestamp.toISOString(),
      offset: log.offset,
      metadata: asUnknownRecord(log.metadata),
    })),
  }
}

function normalizeOffset(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  return Math.max(0, Math.floor(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asUnknownRecord(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null
  }

  return value
}

function asStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null
  }

  const result: Record<string, string> = {}

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      continue
    }

    result[key] = entryValue
  }

  return Object.keys(result).length > 0 ? result : null
}
