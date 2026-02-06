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
import { count, desc, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { generateFilename, getStorageProvider } from "./storage"

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

/**
 * Bug report list item shape for the UI
 */
export interface BugReportListItem {
  id: string
  title: string
  duration: string
  thumbnail: string | undefined
  uploader: {
    name: string
    avatar: string | undefined
  }
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

        return {
          id: r.id,
          title: r.title || "Untitled Bug Report",
          duration: (metadata?.duration as string | undefined) ?? "0:00",
          thumbnail:
            (metadata?.thumbnailUrl as string | undefined) ?? undefined,
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
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      url: z.string().url().optional(),
      attachmentType: z.enum(["video", "screenshot"]),
      attachment: z.instanceof(Blob),
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
    const attachmentUrl = await storage.save(filename, input.attachment)

    await db.insert(bugReport).values({
      id,
      organizationId: activeOrgId,
      reporterId: context.session.user.id,
      title: input.title,
      description: input.description,
      priority: input.priority,
      url: input.url,
      attachmentUrl,
      attachmentType: input.attachmentType,
      deviceInfo: input.deviceInfo,
      status: "open",
      metadata: {},
    })

    return {
      id,
      shareUrl: `/s/${id}`,
    }
  })

/**
 * Get a bug report by ID (public access for shared links)
 */
export const getBugReportById = o
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
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

    return {
      id: report.id,
      title: report.title,
      description: report.description,
      status: report.status,
      priority: report.priority,
      url: report.url,
      attachmentUrl: report.attachmentUrl,
      attachmentType: report.attachmentType,
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
