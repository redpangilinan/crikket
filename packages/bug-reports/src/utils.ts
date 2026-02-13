import type { auth } from "@crikket/auth"
import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import {
  BUG_REPORT_STATUS_OPTIONS,
  BUG_REPORT_VISIBILITY_OPTIONS,
  type BugReportStatus,
  type BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import { ORPCError } from "@orpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

const attachmentTypes = ["video", "screenshot"] as const
export const visibilityValues = Object.values(
  BUG_REPORT_VISIBILITY_OPTIONS
) as [BugReportVisibility, ...BugReportVisibility[]]
export const statusValues = Object.values(BUG_REPORT_STATUS_OPTIONS) as [
  BugReportStatus,
  ...BugReportStatus[],
]
const DEFAULT_DEBUGGER_NETWORK_REQUEST_PAGE_SIZE = 10
const MAX_DEBUGGER_NETWORK_REQUEST_PAGE_SIZE = 200

export type SessionContext = typeof auth.$Infer.Session

export const bugReportIdInputSchema = z.object({
  id: z.string().min(1),
})

export const debuggerNetworkRequestsInputSchema = z.object({
  id: z.string().min(1),
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().optional(),
  search: z
    .string()
    .max(200)
    .transform((value) => value.trim())
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
})

export const debuggerNetworkRequestPayloadInputSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
})

export const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim())
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))

export const metadataInputSchema = z
  .object({
    duration: z.string().max(20).optional(),
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .max(24 * 60 * 60 * 1000)
      .optional(),
    thumbnailUrl: z.string().url().optional(),
    pageTitle: z.string().max(300).optional(),
  })
  .optional()

export function isAttachmentType(
  value: unknown
): value is (typeof attachmentTypes)[number] {
  return (
    typeof value === "string" &&
    (attachmentTypes as readonly string[]).includes(value)
  )
}

export function isVisibility(
  value: unknown
): value is (typeof visibilityValues)[number] {
  return (
    typeof value === "string" &&
    (visibilityValues as readonly string[]).includes(value)
  )
}

export function isStatus(
  value: unknown
): value is (typeof statusValues)[number] {
  return (
    typeof value === "string" &&
    (statusValues as readonly string[]).includes(value)
  )
}

function canAccessPrivateReport(input: {
  organizationId: string
  session?: SessionContext
}): boolean {
  const activeOrgId = input.session?.session.activeOrganizationId
  return (
    Boolean(input.session?.user) &&
    Boolean(activeOrgId) &&
    activeOrgId === input.organizationId
  )
}

export function assertVisibilityAccess(input: {
  visibility: unknown
  organizationId: string
  session?: SessionContext
}): "public" | "private" {
  const visibility = isVisibility(input.visibility)
    ? input.visibility
    : "private"
  if (visibility === "public") {
    return visibility
  }

  if (canAccessPrivateReport(input)) {
    return visibility
  }

  throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
}

export function normalizeDebuggerNetworkRequestPagination(input: {
  page?: number
  perPage?: number
}) {
  const page = input.page ?? 1
  const safePerPage =
    input.perPage ?? DEFAULT_DEBUGGER_NETWORK_REQUEST_PAGE_SIZE
  const perPage = Math.min(
    MAX_DEBUGGER_NETWORK_REQUEST_PAGE_SIZE,
    Math.max(1, safePerPage)
  )
  const offset = (page - 1) * perPage

  return {
    page,
    perPage,
    offset,
    limit: perPage,
  }
}

export function buildFallbackTitle(
  attachmentType: "video" | "screenshot"
): string {
  const now = new Date()
  const label =
    attachmentType === "video" ? "Video Bug Report" : "Screenshot Bug Report"
  const timestamp = now.toISOString().replace("T", " ").slice(0, 16)
  return `${label} - ${timestamp}`
}

export function formatDurationMs(durationMs: number): string {
  const safeDurationMs = Math.max(0, Math.floor(durationMs))
  const totalSeconds = Math.floor(safeDurationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export async function assertBugReportAccessById(input: {
  id: string
  session?: SessionContext
}): Promise<void> {
  const report = await db.query.bugReport.findFirst({
    where: eq(bugReport.id, input.id),
    columns: {
      id: true,
      organizationId: true,
      visibility: true,
    },
  })

  if (!report) {
    throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
  }

  assertVisibilityAccess({
    organizationId: report.organizationId,
    session: input.session,
    visibility: report.visibility,
  })
}
