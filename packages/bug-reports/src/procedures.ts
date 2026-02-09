import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { retryOnUniqueViolation } from "@crikket/shared/lib/retry-on-unique-violation"
import {
  buildPaginationMeta,
  normalizePaginationParams,
  type PaginatedResult,
  paginationParamsSchema,
} from "@crikket/shared/lib/server/pagination"
import { ORPCError, os } from "@orpc/server"
import { and, count, desc, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import {
  bugReportDebuggerInputSchema,
  countBugReportNetworkRequests,
  getBugReportDebuggerEventsData,
  getBugReportNetworkRequestPayload as getBugReportNetworkRequestPayloadData,
  getBugReportNetworkRequestsPage,
  type PersistBugReportDebuggerDataResult,
  persistBugReportDebuggerData,
} from "./debugger"
import {
  extractStorageKeyFromUrl,
  generateFilename,
  getStorageProvider,
} from "./storage"
import {
  assertBugReportAccessById,
  assertVisibilityAccess,
  bugReportIdInputSchema,
  buildFallbackTitle,
  debuggerNetworkRequestPayloadInputSchema,
  debuggerNetworkRequestsInputSchema,
  formatDurationMs,
  isAttachmentType,
  isVisibility,
  metadataInputSchema,
  normalizeDebuggerNetworkRequestPagination,
  optionalText,
  type SessionContext,
  visibilityValues,
} from "./utils"

const o = os.$context<{ session?: SessionContext }>()
const priorityValues = Object.values(PRIORITY_OPTIONS) as [
  Priority,
  ...Priority[],
]

const requireAuth = o.middleware(({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED")
  }
  return next({
    context: {
      session: context.session,
    },
  })
})

const protectedProcedure = o.use(requireAuth)

export interface BugReportListItem {
  id: string
  title: string
  duration: string
  thumbnail: string | undefined
  attachmentUrl: string | undefined
  attachmentType: "video" | "screenshot" | undefined
  uploader: {
    name: string
    avatar: string | undefined
  }
  visibility: "public" | "private"
  createdAt: string
}

/**
 * List bug reports for the current organization (paginated)
 */
export const listBugReports = protectedProcedure
  .input(paginationParamsSchema)
  .handler(
    async ({ context, input }): Promise<PaginatedResult<BugReportListItem>> => {
      const activeOrgId = context.session.session.activeOrganizationId

      if (!activeOrgId) {
        return {
          items: [],
          pagination: buildPaginationMeta(0, 1, 10),
        }
      }

      const { page, perPage, offset, limit } = normalizePaginationParams(input)

      const countResult = await db
        .select({ value: count() })
        .from(bugReport)
        .where(eq(bugReport.organizationId, activeOrgId))

      const totalCount = countResult[0]?.value ?? 0

      const bugReports = await db.query.bugReport.findMany({
        where: eq(bugReport.organizationId, activeOrgId),
        orderBy: [desc(bugReport.createdAt)],
        limit,
        offset,
        with: {
          reporter: true,
        },
      })

      const items = bugReports.map((r) => {
        const metadata = r.metadata as Record<string, unknown> | null
        const attachmentType = isAttachmentType(r.attachmentType)
          ? r.attachmentType
          : undefined
        const visibility = isVisibility(r.visibility) ? r.visibility : "private"
        const durationMs = metadata?.durationMs
        const normalizedDurationMs =
          typeof durationMs === "number" && Number.isFinite(durationMs)
            ? Math.max(0, Math.floor(durationMs))
            : null

        return {
          id: r.id,
          title: r.title || "Untitled Bug Report",
          duration:
            (metadata?.duration as string | undefined) ??
            (normalizedDurationMs !== null
              ? formatDurationMs(normalizedDurationMs)
              : "0:00"),
          thumbnail:
            (metadata?.thumbnailUrl as string | undefined) ??
            (attachmentType === "screenshot"
              ? (r.attachmentUrl ?? undefined)
              : undefined),
          attachmentUrl: r.attachmentUrl ?? undefined,
          attachmentType,
          visibility,
          uploader: {
            name: r.reporter?.name || "Unknown User",
            avatar: r.reporter?.image ?? undefined,
          },
          createdAt: r.createdAt.toISOString(),
        }
      })

      return {
        items,
        pagination: buildPaginationMeta(totalCount, page, perPage),
      }
    }
  )

/**
 * Create a new bug report with file attachment
 */
export const createBugReport = protectedProcedure
  .input(
    z.object({
      title: optionalText(200),
      description: optionalText(3000),
      priority: z.enum(priorityValues).default(PRIORITY_OPTIONS.none),
      url: z.string().url().optional(),
      attachmentType: z.enum(["video", "screenshot"]),
      visibility: z.enum(visibilityValues).default("private"),
      attachment: z.instanceof(Blob),
      metadata: metadataInputSchema,
      debugger: bugReportDebuggerInputSchema,
      deviceInfo: z
        .object({
          browser: z.string().optional(),
          os: z.string().optional(),
          viewport: z.string().optional(),
        })
        .optional(),
    })
  )
  .handler(async ({ context, input }) => {
    const activeOrgId = context.session.session.activeOrganizationId

    if (!activeOrgId) {
      throw new ORPCError("BAD_REQUEST", { message: "No active organization" })
    }

    const storage = getStorageProvider()
    const filename = generateFilename(input.attachmentType)

    let attachmentUrl: string
    try {
      attachmentUrl = await storage.save(filename, input.attachment)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown storage error"
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Attachment upload failed: ${message}`,
      })
    }

    const normalizedMetadata = {
      duration:
        input.metadata?.duration ??
        (typeof input.metadata?.durationMs === "number"
          ? formatDurationMs(input.metadata.durationMs)
          : undefined),
      durationMs: input.metadata?.durationMs,
      thumbnailUrl:
        input.metadata?.thumbnailUrl ??
        (input.attachmentType === "screenshot" ? attachmentUrl : undefined),
      pageTitle: input.metadata?.pageTitle,
    }

    const inferredTitle =
      input.title ??
      input.metadata?.pageTitle?.trim() ??
      buildFallbackTitle(input.attachmentType)

    const { id } = await retryOnUniqueViolation(async () => {
      const generatedId = nanoid(12)

      await db.insert(bugReport).values({
        id: generatedId,
        organizationId: activeOrgId,
        reporterId: context.session.user.id,
        title: inferredTitle,
        description: input.description,
        priority: input.priority,
        url: input.url,
        attachmentUrl,
        attachmentKey: filename,
        attachmentType: input.attachmentType,
        visibility: input.visibility,
        deviceInfo: input.deviceInfo,
        status: "open",
        metadata: normalizedMetadata,
      })

      return { id: generatedId }
    })

    let debuggerPersistence: PersistBugReportDebuggerDataResult
    try {
      debuggerPersistence = await persistBugReportDebuggerData(
        id,
        input.debugger
      )
    } catch (error) {
      reportNonFatalError(
        `Failed to persist debugger data for bug report ${id}`,
        error
      )
      debuggerPersistence = {
        requested: {
          actions: input.debugger?.actions.length ?? 0,
          logs: input.debugger?.logs.length ?? 0,
          networkRequests: input.debugger?.networkRequests.length ?? 0,
        },
        persisted: {
          actions: 0,
          logs: 0,
          networkRequests: 0,
        },
        dropped: {
          actions: input.debugger?.actions.length ?? 0,
          logs: input.debugger?.logs.length ?? 0,
          networkRequests: input.debugger?.networkRequests.length ?? 0,
        },
        warnings: ["Failed to store debugger data for this report."],
      }
    }

    return {
      id,
      shareUrl: `/s/${id}`,
      warnings: debuggerPersistence.warnings,
      debugger: debuggerPersistence,
    }
  })

/**
 * Get a bug report by ID (public access for shared links)
 */
export const getBugReportById = o
  .input(bugReportIdInputSchema)
  .handler(async ({ context, input }) => {
    const report = await db.query.bugReport.findFirst({
      where: eq(bugReport.id, input.id),
      with: {
        reporter: true,
        organization: true,
      },
    })

    if (!report) {
      throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
    }

    const visibility = assertVisibilityAccess({
      organizationId: report.organizationId,
      session: context.session,
      visibility: report.visibility,
    })

    return {
      id: report.id,
      title: report.title,
      description: report.description,
      status: report.status,
      priority: report.priority,
      url: report.url,
      attachmentUrl: report.attachmentUrl,
      attachmentType: report.attachmentType,
      visibility,
      deviceInfo: report.deviceInfo,
      metadata: report.metadata,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      reporter: report.reporter
        ? {
            name: report.reporter.name,
            image: report.reporter.image,
          }
        : null,
      organization: {
        name: report.organization.name,
        logo: report.organization.logo,
      },
    }
  })

/**
 * Get debugger actions/logs separately from core report metadata.
 */
export const getBugReportDebuggerEvents = o
  .input(bugReportIdInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    return getBugReportDebuggerEventsData(input.id)
  })

/**
 * Get paginated network request metadata (without request/response bodies).
 */
export const getBugReportNetworkRequests = o
  .input(debuggerNetworkRequestsInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    const { page, perPage, offset, limit } =
      normalizeDebuggerNetworkRequestPagination({
        page: input.page,
        perPage: input.perPage,
      })

    const [totalCount, items] = await Promise.all([
      countBugReportNetworkRequests({
        bugReportId: input.id,
        search: input.search,
      }),
      getBugReportNetworkRequestsPage({
        bugReportId: input.id,
        limit,
        offset,
        search: input.search,
      }),
    ])

    return {
      items,
      pagination: buildPaginationMeta(totalCount, page, perPage),
    }
  })

/**
 * Get request/response payload bodies for a single network request on-demand.
 */
export const getBugReportNetworkRequestPayload = o
  .input(debuggerNetworkRequestPayloadInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    const payload = await getBugReportNetworkRequestPayloadData({
      bugReportId: input.id,
      requestId: input.requestId,
    })

    if (!payload) {
      throw new ORPCError("NOT_FOUND", { message: "Network request not found" })
    }

    return payload
  })

export const deleteBugReport = protectedProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const activeOrgId = context.session.session.activeOrganizationId
    if (!activeOrgId) {
      throw new ORPCError("BAD_REQUEST", { message: "No active organization" })
    }

    const report = await db.query.bugReport.findFirst({
      where: and(
        eq(bugReport.id, input.id),
        eq(bugReport.organizationId, activeOrgId)
      ),
    })

    if (!report) {
      throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
    }

    const storage = getStorageProvider()
    const attachmentKey =
      report.attachmentKey ??
      (report.attachmentUrl
        ? extractStorageKeyFromUrl(report.attachmentUrl, storage)
        : null)

    if (attachmentKey) {
      await storage.remove(attachmentKey)
    }

    await db
      .delete(bugReport)
      .where(
        and(
          eq(bugReport.id, input.id),
          eq(bugReport.organizationId, activeOrgId)
        )
      )

    return { id: input.id }
  })

export const deleteBugReportsBulk = protectedProcedure
  .input(
    z.object({
      ids: z.array(z.string().min(1)).min(1).max(200),
    })
  )
  .handler(async ({ context, input }) => {
    const activeOrgId = context.session.session.activeOrganizationId
    if (!activeOrgId) {
      throw new ORPCError("BAD_REQUEST", { message: "No active organization" })
    }

    const uniqueIds = Array.from(new Set(input.ids))
    const reports = await db.query.bugReport.findMany({
      where: and(
        eq(bugReport.organizationId, activeOrgId),
        inArray(bugReport.id, uniqueIds)
      ),
      columns: {
        id: true,
        attachmentKey: true,
        attachmentUrl: true,
      },
    })

    if (reports.length === 0) {
      return { deletedCount: 0 }
    }

    const storage = getStorageProvider()

    for (const report of reports) {
      const attachmentKey =
        report.attachmentKey ??
        (report.attachmentUrl
          ? extractStorageKeyFromUrl(report.attachmentUrl, storage)
          : null)

      if (attachmentKey) {
        await storage.remove(attachmentKey)
      }
    }

    await db.delete(bugReport).where(
      and(
        eq(bugReport.organizationId, activeOrgId),
        inArray(
          bugReport.id,
          reports.map((report) => report.id)
        )
      )
    )

    return { deletedCount: reports.length }
  })

export const updateBugReportVisibility = protectedProcedure
  .input(
    z.object({
      id: z.string().min(1),
      visibility: z.enum(visibilityValues),
    })
  )
  .handler(async ({ context, input }) => {
    const activeOrgId = context.session.session.activeOrganizationId
    if (!activeOrgId) {
      throw new ORPCError("BAD_REQUEST", { message: "No active organization" })
    }

    const updated = await db
      .update(bugReport)
      .set({ visibility: input.visibility })
      .where(
        and(
          eq(bugReport.id, input.id),
          eq(bugReport.organizationId, activeOrgId)
        )
      )
      .returning({ id: bugReport.id, visibility: bugReport.visibility })

    const report = updated[0]
    if (!report) {
      throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
    }

    return {
      id: report.id,
      visibility: isVisibility(report.visibility)
        ? report.visibility
        : "private",
    }
  })
