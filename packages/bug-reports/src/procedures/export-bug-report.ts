import { db } from "@crikket/db"
import {
  bugReport,
  bugReportNetworkRequest,
} from "@crikket/db/schema/bug-report"
import { ORPCError } from "@orpc/server"
import { asc, eq } from "drizzle-orm"
import { getBugReportDebuggerEventsData } from "../lib/debugger"
import { assertBugReportAccessById, bugReportIdInputSchema } from "../lib/utils"
import { o } from "./context"

export const exportBugReportDiagnostics = o
  .input(bugReportIdInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    const report = await db.query.bugReport.findFirst({
      where: eq(bugReport.id, input.id),
      columns: {
        id: true,
        title: true,
        description: true,
        url: true,
        status: true,
        priority: true,
        visibility: true,
        tags: true,
        deviceInfo: true,
        attachmentType: true,
        submissionStatus: true,
        debuggerIngestionStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!report) {
      throw new ORPCError("NOT_FOUND", {
        message: "Bug report not found",
      })
    }

    const events = await getBugReportDebuggerEventsData(input.id)

    const networkRequests = await db
      .select({
        id: bugReportNetworkRequest.id,
        method: bugReportNetworkRequest.method,
        url: bugReportNetworkRequest.url,
        status: bugReportNetworkRequest.status,
        duration: bugReportNetworkRequest.duration,
        requestHeaders: bugReportNetworkRequest.requestHeaders,
        responseHeaders: bugReportNetworkRequest.responseHeaders,
        requestBody: bugReportNetworkRequest.requestBody,
        responseBody: bugReportNetworkRequest.responseBody,
        timestamp: bugReportNetworkRequest.timestamp,
        offset: bugReportNetworkRequest.offset,
      })
      .from(bugReportNetworkRequest)
      .where(eq(bugReportNetworkRequest.bugReportId, input.id))
      .orderBy(
        asc(bugReportNetworkRequest.timestamp),
        asc(bugReportNetworkRequest.id)
      )

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      report: {
        ...report,
        tags: report.tags ?? [],
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
      },
      actions: events.actions,
      logs: events.logs,
      networkRequests: networkRequests.map((request) => ({
        ...request,
        timestamp: request.timestamp.toISOString(),
      })),
    }
  })
