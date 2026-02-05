import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import { desc, eq } from "drizzle-orm"

import { protectedProcedure } from "../index"

export const bugReportRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const activeOrgId = context.session.session.activeOrganizationId

    if (!activeOrgId) {
      return []
    }

    const bugReports = await db.query.bugReport.findMany({
      where: eq(bugReport.organizationId, activeOrgId),
      orderBy: [desc(bugReport.createdAt)],
      with: {
        reporter: true,
      },
    })

    return bugReports.map((r) => {
      const metadata = r.metadata as Record<string, unknown> | null

      return {
        id: r.id,
        title: r.title || "Untitled Bug Report",
        duration: metadata?.duration || "0:00",
        thumbnail: metadata?.thumbnailUrl || undefined,
        uploader: {
          name: r.reporter?.name || "Unknown User",
          avatar: r.reporter?.image || undefined,
        },
        createdAt: r.createdAt.toISOString(),
      }
    })
  }),
}
