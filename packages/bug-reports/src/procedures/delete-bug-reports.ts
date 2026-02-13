import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import { ORPCError } from "@orpc/server"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { extractStorageKeyFromUrl, getStorageProvider } from "../storage"
import { protectedProcedure } from "./context"
import { requireActiveOrgId } from "./helpers"

export const deleteBugReport = protectedProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const activeOrgId = requireActiveOrgId(context.session)

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
    const activeOrgId = requireActiveOrgId(context.session)
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
