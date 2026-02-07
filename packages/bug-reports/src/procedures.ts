import type { auth } from "@crikket/auth"
import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
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
  extractStorageKeyFromUrl,
  generateFilename,
  getStorageProvider,
} from "./storage"

type SessionContext = typeof auth.$Infer.Session

const o = os.$context<{ session?: SessionContext }>()

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

const attachmentTypes = ["video", "screenshot"] as const
const visibilityValues = ["public", "private"] as const

function isAttachmentType(
  value: unknown
): value is (typeof attachmentTypes)[number] {
  return (
    typeof value === "string" &&
    (attachmentTypes as readonly string[]).includes(value)
  )
}

function isVisibility(
  value: unknown
): value is (typeof visibilityValues)[number] {
  return (
    typeof value === "string" &&
    (visibilityValues as readonly string[]).includes(value)
  )
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim())
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))

const metadataInputSchema = z
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
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      url: z.string().url().optional(),
      attachmentType: z.enum(["video", "screenshot"]),
      visibility: z.enum(visibilityValues).default("private"),
      attachment: z.instanceof(Blob),
      metadata: metadataInputSchema,
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

    const id = nanoid(12)

    const storage = getStorageProvider()
    const filename = generateFilename(id, input.attachmentType)

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

    await db.insert(bugReport).values({
      id,
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

    return {
      id,
      shareUrl: `/s/${id}`,
    }
  })

function buildFallbackTitle(attachmentType: "video" | "screenshot"): string {
  const now = new Date()
  const label =
    attachmentType === "video" ? "Video Bug Report" : "Screenshot Bug Report"
  const timestamp = now.toISOString().replace("T", " ").slice(0, 16)
  return `${label} - ${timestamp}`
}

function formatDurationMs(durationMs: number): string {
  const safeDurationMs = Math.max(0, Math.floor(durationMs))
  const totalSeconds = Math.floor(safeDurationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

/**
 * Get a bug report by ID (public access for shared links)
 */
export const getBugReportById = o
  .input(z.object({ id: z.string() }))
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

    const visibility = isVisibility(report.visibility)
      ? report.visibility
      : "private"
    const activeOrgId = context.session?.session.activeOrganizationId
    const canAccessPrivate =
      Boolean(context.session?.user) &&
      Boolean(activeOrgId) &&
      activeOrgId === report.organizationId

    if (visibility !== "public" && !canAccessPrivate) {
      throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
    }

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
