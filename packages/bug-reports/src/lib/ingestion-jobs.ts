import { gunzipSync } from "node:zlib"
import { db } from "@crikket/db"
import { bugReport, bugReportIngestionJob } from "@crikket/db/schema/bug-report"
import {
  BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS,
  BUG_REPORT_SUBMISSION_STATUS_OPTIONS,
} from "@crikket/shared/constants/bug-report"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { ORPCError } from "@orpc/server"
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import {
  clearBugReportDebuggerData,
  type PersistBugReportDebuggerDataResult,
  persistBugReportDebuggerData,
} from "./debugger"
import {
  calculateBugReportIngestionRetryDelayMs,
  resolveBugReportIngestionFailureStatus,
} from "./ingestion-policy"
import { getStorageProvider } from "./storage"

const BUG_REPORT_INGESTION_JOB_TYPE = "debugger_ingestion"
const BUG_REPORT_INGESTION_STALE_PROCESSING_MS = 5 * 60 * 1000
const BUG_REPORT_INGESTION_DEFAULT_BATCH = 25
const BUG_REPORT_INGESTION_MAX_ERROR_LENGTH = 2000

type BugReportIngestionJobStatus =
  | "completed"
  | "dead_letter"
  | "failed"
  | "pending"
  | "processing"
  | "skipped"

interface QueueBugReportIngestionJobInput {
  bugReportId: string
  organizationId: string
}

interface ProcessBugReportIngestionJobInput {
  jobId: string
}

interface ProcessBugReportIngestionJobResult {
  debugger: PersistBugReportDebuggerDataResult
  status: BugReportIngestionJobStatus
}

export async function retryBugReportDebuggerIngestion(input: {
  bugReportId: string
  organizationId: string
}): Promise<ProcessBugReportIngestionJobResult> {
  const report = await db.query.bugReport.findFirst({
    where: and(
      eq(bugReport.id, input.bugReportId),
      eq(bugReport.organizationId, input.organizationId)
    ),
    columns: {
      captureKey: true,
      debuggerKey: true,
      id: true,
      organizationId: true,
    },
  })

  if (!report) {
    throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
  }

  if (!report.debuggerKey) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Bug report has no debugger artifact to ingest.",
    })
  }

  if (!report.captureKey) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Bug report capture artifact is missing.",
    })
  }

  const storage = getStorageProvider()
  const hasCapture = await storage.exists(report.captureKey)
  if (!hasCapture) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Capture upload has not completed yet.",
    })
  }

  const { jobId } = await queueBugReportIngestionJob({
    bugReportId: report.id,
    organizationId: report.organizationId,
  })

  return processBugReportIngestionJob({ jobId })
}

export async function queueBugReportIngestionJob(
  input: QueueBugReportIngestionJobInput
): Promise<{ jobId: string }> {
  const jobId = nanoid(16)

  await db.insert(bugReportIngestionJob).values({
    id: jobId,
    bugReportId: input.bugReportId,
    organizationId: input.organizationId,
    jobType: BUG_REPORT_INGESTION_JOB_TYPE,
    status: "pending",
  })

  return { jobId }
}

export async function processBugReportIngestionJob(
  input: ProcessBugReportIngestionJobInput
): Promise<ProcessBugReportIngestionJobResult> {
  const claimedJob = await claimBugReportIngestionJob(input.jobId)

  if (!claimedJob) {
    return {
      debugger: createEmptyDebuggerPersistence(),
      status: "skipped",
    }
  }

  const report = await db.query.bugReport.findFirst({
    where: eq(bugReport.id, claimedJob.bugReportId),
  })

  if (!report?.debuggerKey) {
    await markBugReportIngestionJobCompleted(claimedJob.jobId)

    return {
      debugger: createEmptyDebuggerPersistence(),
      status: "completed",
    }
  }

  if (
    report.submissionStatus === BUG_REPORT_SUBMISSION_STATUS_OPTIONS.ready &&
    report.debuggerIngestionStatus ===
      BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.completed
  ) {
    await markBugReportIngestionJobCompleted(claimedJob.jobId)

    return {
      debugger: createEmptyDebuggerPersistence(),
      status: "completed",
    }
  }

  await db
    .update(bugReport)
    .set({
      debuggerIngestionStatus:
        BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.processing,
      debuggerIngestionError: null,
      submissionStatus: BUG_REPORT_SUBMISSION_STATUS_OPTIONS.processing,
      updatedAt: new Date(),
    })
    .where(eq(bugReport.id, report.id))

  try {
    const persistence = await ingestDebuggerPayload({
      bugReportId: report.id,
      debuggerContentEncoding: report.debuggerContentEncoding,
      debuggerKey: report.debuggerKey,
    })
    const hasFailedPersistence =
      persistence.warnings.length > 0 &&
      persistence.persisted.actions === 0 &&
      persistence.persisted.logs === 0 &&
      persistence.persisted.networkRequests === 0

    if (hasFailedPersistence) {
      const error = persistence.warnings.join(" ")
      return {
        debugger: persistence,
        status: await markBugReportIngestionJobFailure({
          attempts: claimedJob.attempts,
          bugReportId: report.id,
          error,
          jobId: claimedJob.jobId,
        }),
      }
    }

    await db
      .update(bugReport)
      .set({
        debuggerIngestionStatus:
          BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.completed,
        debuggerIngestedAt: new Date(),
        debuggerIngestionError: null,
        submissionStatus: BUG_REPORT_SUBMISSION_STATUS_OPTIONS.ready,
        updatedAt: new Date(),
      })
      .where(eq(bugReport.id, report.id))

    await markBugReportIngestionJobCompleted(claimedJob.jobId)

    return {
      debugger: persistence,
      status: "completed",
    }
  } catch (error) {
    const message = serializeIngestionError(error)

    reportNonFatalError(
      `Failed to ingest debugger payload for bug report ${report.id}`,
      error
    )

    return {
      debugger: createEmptyDebuggerPersistence([
        "Failed to process debugger data for this report.",
      ]),
      status: await markBugReportIngestionJobFailure({
        attempts: claimedJob.attempts,
        bugReportId: report.id,
        error: message,
        jobId: claimedJob.jobId,
      }),
    }
  }
}

export async function runBugReportIngestionPass(options?: {
  limit?: number
}): Promise<{
  completed: number
  deadLettered: number
  processed: number
  retried: number
  skipped: number
}> {
  const now = new Date()
  const staleProcessingThreshold = new Date(
    Date.now() - BUG_REPORT_INGESTION_STALE_PROCESSING_MS
  )
  const dueJobs = await db.query.bugReportIngestionJob.findMany({
    where: or(
      and(
        inArray(bugReportIngestionJob.status, ["pending", "failed"]),
        lte(bugReportIngestionJob.nextAttemptAt, now)
      ),
      and(
        eq(bugReportIngestionJob.status, "processing"),
        lte(bugReportIngestionJob.updatedAt, staleProcessingThreshold)
      )
    ),
    orderBy: [asc(bugReportIngestionJob.nextAttemptAt)],
    limit: options?.limit ?? BUG_REPORT_INGESTION_DEFAULT_BATCH,
  })

  let completed = 0
  let deadLettered = 0
  let retried = 0
  let skipped = 0

  for (const job of dueJobs) {
    const result = await processBugReportIngestionJob({ jobId: job.id })

    if (result.status === "completed") {
      completed += 1
      continue
    }

    if (result.status === "dead_letter") {
      deadLettered += 1
      continue
    }

    if (result.status === "failed") {
      retried += 1
      continue
    }

    skipped += 1
  }

  return {
    completed,
    deadLettered,
    processed: dueJobs.length,
    retried,
    skipped,
  }
}

function createEmptyDebuggerPersistence(
  warnings: string[] = []
): PersistBugReportDebuggerDataResult {
  return {
    requested: {
      actions: 0,
      logs: 0,
      networkRequests: 0,
    },
    persisted: {
      actions: 0,
      logs: 0,
      networkRequests: 0,
    },
    dropped: {
      actions: 0,
      logs: 0,
      networkRequests: 0,
    },
    warnings,
  }
}

async function claimBugReportIngestionJob(
  jobId: string
): Promise<{ attempts: number; bugReportId: string; jobId: string } | null> {
  const staleProcessingThreshold = new Date(
    Date.now() - BUG_REPORT_INGESTION_STALE_PROCESSING_MS
  )
  const [claimedJob] = await db
    .update(bugReportIngestionJob)
    .set({
      status: "processing",
      attempts: sql`${bugReportIngestionJob.attempts} + 1`,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bugReportIngestionJob.id, jobId),
        or(
          inArray(bugReportIngestionJob.status, ["pending", "failed"]),
          and(
            eq(bugReportIngestionJob.status, "processing"),
            lte(bugReportIngestionJob.updatedAt, staleProcessingThreshold)
          )
        )
      )
    )
    .returning({
      attempts: bugReportIngestionJob.attempts,
      bugReportId: bugReportIngestionJob.bugReportId,
      id: bugReportIngestionJob.id,
    })

  if (!claimedJob) {
    return null
  }

  return {
    attempts: claimedJob.attempts,
    bugReportId: claimedJob.bugReportId,
    jobId: claimedJob.id,
  }
}

async function ingestDebuggerPayload(input: {
  bugReportId: string
  debuggerContentEncoding: string | null
  debuggerKey: string
}): Promise<PersistBugReportDebuggerDataResult> {
  const storage = getStorageProvider()
  const storedPayload = await storage.read(input.debuggerKey)
  // Some S3 backends decompress Content-Encoding: gzip on read, so check the
  // actual magic bytes rather than the recorded encoding before gunzipping.
  const isGzip =
    input.debuggerContentEncoding === "gzip" &&
    storedPayload.length >= 2 &&
    storedPayload[0] === 0x1f &&
    storedPayload[1] === 0x8b
  const payloadBuffer = isGzip ? gunzipSync(storedPayload) : storedPayload
  const rawPayload = JSON.parse(payloadBuffer.toString("utf8")) as {
    actions?: unknown[]
    logs?: unknown[]
    networkRequests?: unknown[]
  }

  await clearBugReportDebuggerData(input.bugReportId)

  return persistBugReportDebuggerData(input.bugReportId, {
    actions: rawPayload.actions ?? [],
    logs: rawPayload.logs ?? [],
    networkRequests: rawPayload.networkRequests ?? [],
  })
}

async function markBugReportIngestionJobCompleted(
  jobId: string
): Promise<void> {
  await db
    .update(bugReportIngestionJob)
    .set({
      status: "completed",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(bugReportIngestionJob.id, jobId))
}

async function markBugReportIngestionJobFailure(input: {
  attempts: number
  bugReportId: string
  error: string
  jobId: string
}): Promise<"dead_letter" | "failed"> {
  const status = resolveBugReportIngestionFailureStatus(input.attempts)
  const nextAttemptAt = new Date(
    Date.now() + calculateBugReportIngestionRetryDelayMs(input.attempts)
  )

  await db
    .update(bugReport)
    .set({
      debuggerIngestionStatus:
        BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.failed,
      debuggerIngestionError: input.error,
      submissionStatus: BUG_REPORT_SUBMISSION_STATUS_OPTIONS.failed,
      updatedAt: new Date(),
    })
    .where(eq(bugReport.id, input.bugReportId))

  await db
    .update(bugReportIngestionJob)
    .set({
      status,
      lastError: input.error,
      nextAttemptAt,
      updatedAt: new Date(),
    })
    .where(eq(bugReportIngestionJob.id, input.jobId))

  return status
}

function serializeIngestionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, BUG_REPORT_INGESTION_MAX_ERROR_LENGTH)
}
