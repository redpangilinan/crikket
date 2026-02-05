import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import { count, desc, eq } from "drizzle-orm"

import { protectedProcedure } from "../index"
import {
  buildPaginationMeta,
  normalizePaginationParams,
  paginationParamsSchema,
} from "../lib/utils/pagination"

export const bugReportRouter = {
  list: protectedProcedure
    .input(paginationParamsSchema)
    .handler(async ({ context, input }) => {
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
    }),
}
