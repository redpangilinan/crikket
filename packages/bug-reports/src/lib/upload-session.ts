import { db } from "@crikket/db"
import {
  bugReport,
  bugReportUploadSession,
} from "@crikket/db/schema/bug-report"
import {
  BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS,
  BUG_REPORT_SUBMISSION_STATUS_OPTIONS,
  type BugReportSubmissionStatus,
} from "@crikket/shared/constants/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import { retryOnUniqueViolation } from "@crikket/shared/lib/server/retry-on-unique-violation"
import { ORPCError } from "@orpc/server"
import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import {
  buildCaptureArtifactKey,
  buildDebuggerArtifactKey,
} from "./artifact-storage"
import type { PersistBugReportDebuggerDataResult } from "./debugger"
import {
  assertCreateBugReportEntitlements,
  type CreateBugReportEntitlementInput,
} from "./entitlements"
import {
  processBugReportIngestionJob,
  queueBugReportIngestionJob,
} from "./ingestion-jobs"
import { getStorageProvider } from "./storage"
import {
  buildFallbackTitle,
  formatDurationMs,
  metadataInputSchema,
  optionalText,
  visibilityValues,
} from "./utils"

const priorityValues = Object.values(PRIORITY_OPTIONS) as [
  Priority,
  ...Priority[],
]

const MAX_CONTENT_TYPE_LENGTH = 120
const MAX_CONTENT_ENCODING_LENGTH = 40
const BUG_REPORT_UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000

const debuggerSummarySchema = z.object({
  actions: z.number().int().nonnegative(),
  logs: z.number().int().nonnegative(),
  networkRequests: z.number().int().nonnegative(),
})

export const createBugReportUploadSessionInputSchema = z.object({
  title: optionalText(200),
  description: optionalText(3000),
  priority: z.enum(priorityValues).default(PRIORITY_OPTIONS.none),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  url: z.string().url().optional(),
  attachmentType: z.enum(["video", "screenshot"]),
  visibility: z.enum(visibilityValues).default("private"),
  metadata: metadataInputSchema,
  deviceInfo: z
    .object({
      browser: z.string().optional(),
      os: z.string().optional(),
      viewport: z.string().optional(),
    })
    .optional(),
  captureContentType: z.string().max(MAX_CONTENT_TYPE_LENGTH).optional(),
  hasDebuggerPayload: z.boolean().default(false),
  debuggerSummary: debuggerSummarySchema.optional(),
})

export const finalizeBugReportUploadInputSchema = z.object({
  id: z.string().min(1),
  captureContentType: z.string().max(MAX_CONTENT_TYPE_LENGTH).optional(),
  captureSizeBytes: z.number().int().nonnegative().optional(),
  debuggerSizeBytes: z.number().int().nonnegative().optional(),
  debuggerContentEncoding: z
    .string()
    .max(MAX_CONTENT_ENCODING_LENGTH)
    .optional(),
})

type CreateBugReportUploadSessionInput = z.infer<
  typeof createBugReportUploadSessionInputSchema
>
type FinalizeBugReportUploadInput = z.infer<
  typeof finalizeBugReportUploadInputSchema
>

function normalizeUploadMetadata(
  metadata: CreateBugReportUploadSessionInput["metadata"]
) {
  return {
    duration:
      metadata?.duration ??
      (typeof metadata?.durationMs === "number"
        ? formatDurationMs(metadata.durationMs)
        : undefined),
    durationMs: metadata?.durationMs,
    pageTitle: metadata?.pageTitle,
    sdkVersion: metadata?.sdkVersion,
    submittedVia: metadata?.submittedVia,
    thumbnailUrl: metadata?.thumbnailUrl,
  }
}

function buildEntitlementPayload(
  input: CreateBugReportUploadSessionInput
): CreateBugReportEntitlementInput {
  return {
    attachmentType: input.attachmentType,
    metadata: {
      durationMs: input.metadata?.durationMs,
    },
  }
}

function resolveCaptureContentType(input: {
  captureContentType?: string
  captureType: "video" | "screenshot"
}): string {
  if (input.captureContentType) {
    return input.captureContentType
  }

  return input.captureType === "video" ? "video/webm" : "image/png"
}

export async function createBugReportUploadSession(input: {
  input: CreateBugReportUploadSessionInput
  organizationId: string
  reporterId?: string | null
  tags?: string[] | undefined
}): Promise<{
  bugReportId: string
  captureUpload: {
    headers: Record<string, string>
    key: string
    method: "PUT"
    url: string
  }
  debuggerUpload?: {
    headers: Record<string, string>
    key: string
    method: "PUT"
    url: string
  }
}> {
  await assertCreateBugReportEntitlements({
    organizationId: input.organizationId,
    payload: buildEntitlementPayload(input.input),
  })

  const storage = getStorageProvider()
  const normalizedMetadata = normalizeUploadMetadata(input.input.metadata)
  const inferredTitle =
    input.input.title ??
    input.input.metadata?.pageTitle?.trim() ??
    buildFallbackTitle(input.input.attachmentType)

  const result = await retryOnUniqueViolation(async () => {
    const bugReportId = nanoid(12)
    const captureKey = buildCaptureArtifactKey({
      organizationId: input.organizationId,
      bugReportId,
      captureType: input.input.attachmentType,
    })
    const debuggerKey = input.input.hasDebuggerPayload
      ? buildDebuggerArtifactKey({
          organizationId: input.organizationId,
          bugReportId,
        })
      : null

    await db.insert(bugReportUploadSession).values({
      id: bugReportId,
      organizationId: input.organizationId,
      reporterId: input.reporterId ?? null,
      title: inferredTitle,
      description: input.input.description,
      priority: input.input.priority,
      tags: input.tags,
      url: input.input.url,
      attachmentType: input.input.attachmentType,
      captureKey,
      captureContentType: resolveCaptureContentType({
        captureContentType: input.input.captureContentType,
        captureType: input.input.attachmentType,
      }),
      debuggerKey,
      visibility: input.input.visibility,
      deviceInfo: input.input.deviceInfo,
      metadata: {
        ...normalizedMetadata,
        debuggerSummary: input.input.debuggerSummary,
      },
      expiresAt: new Date(Date.now() + BUG_REPORT_UPLOAD_SESSION_TTL_MS),
    })

    const captureUpload = await storage.createUploadUrl({
      filename: captureKey,
      contentType: resolveCaptureContentType({
        captureContentType: input.input.captureContentType,
        captureType: input.input.attachmentType,
      }),
    })

    const debuggerUpload = debuggerKey
      ? await storage.createUploadUrl({
          filename: debuggerKey,
          contentType: "application/json",
        })
      : null

    return {
      bugReportId,
      captureKey,
      captureUpload,
      debuggerKey,
      debuggerUpload,
    }
  })

  return {
    bugReportId: result.bugReportId,
    captureUpload: {
      ...result.captureUpload,
      key: result.captureKey,
    },
    debuggerUpload:
      result.debuggerKey && result.debuggerUpload
        ? {
            ...result.debuggerUpload,
            key: result.debuggerKey,
          }
        : undefined,
  }
}

export async function finalizeBugReportUpload(input: {
  input: FinalizeBugReportUploadInput
  organizationId: string
}): Promise<{
  debugger: PersistBugReportDebuggerDataResult
  id: string
  shareUrl: string
  submissionStatus: BugReportSubmissionStatus
  warnings: string[]
}> {
  const uploadSession = await db.query.bugReportUploadSession.findFirst({
    where: and(
      eq(bugReportUploadSession.id, input.input.id),
      eq(bugReportUploadSession.organizationId, input.organizationId)
    ),
  })

  if (!uploadSession) {
    const existingReport = await db.query.bugReport.findFirst({
      where: and(
        eq(bugReport.id, input.input.id),
        eq(bugReport.organizationId, input.organizationId)
      ),
      columns: {
        id: true,
        submissionStatus: true,
      },
    })

    if (existingReport) {
      if (
        existingReport.submissionStatus !==
        BUG_REPORT_SUBMISSION_STATUS_OPTIONS.ready
      ) {
        throw new ORPCError("CONFLICT", {
          message: "Bug report submission is still processing.",
        })
      }

      return {
        debugger: createEmptyDebuggerPersistence(),
        id: existingReport.id,
        shareUrl: `/s/${existingReport.id}`,
        submissionStatus: existingReport.submissionStatus,
        warnings: [],
      }
    }

    throw new ORPCError("NOT_FOUND", { message: "Bug report upload not found" })
  }

  if (uploadSession.expiresAt.getTime() <= Date.now()) {
    await db
      .delete(bugReportUploadSession)
      .where(eq(bugReportUploadSession.id, uploadSession.id))

    throw new ORPCError("BAD_REQUEST", {
      message: "Bug report upload session expired. Start a new submission.",
    })
  }

  const storage = getStorageProvider()
  const hasCapture = await storage.exists(uploadSession.captureKey)
  if (!hasCapture) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Capture upload has not completed yet.",
    })
  }

  if (uploadSession.debuggerKey) {
    const hasDebugger = await storage.exists(uploadSession.debuggerKey)
    if (!hasDebugger) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Debugger upload has not completed yet.",
      })
    }
  }

  const captureContentType =
    input.input.captureContentType ??
    uploadSession.captureContentType ??
    resolveCaptureContentType({
      captureType:
        uploadSession.attachmentType === "screenshot" ? "screenshot" : "video",
    })
  const captureUploadedAt = new Date()
  const debuggerUploadedAt =
    uploadSession.debuggerKey && (input.input.debuggerSizeBytes ?? 0) > 0
      ? new Date()
      : null

  await db.transaction(async (tx) => {
    await tx.insert(bugReport).values({
      id: uploadSession.id,
      organizationId: uploadSession.organizationId,
      reporterId: uploadSession.reporterId,
      title: uploadSession.title,
      description: uploadSession.description,
      priority: uploadSession.priority,
      tags: uploadSession.tags,
      url: uploadSession.url,
      attachmentType: uploadSession.attachmentType,
      captureKey: uploadSession.captureKey,
      captureContentType,
      captureSizeBytes: input.input.captureSizeBytes ?? null,
      captureUploadedAt,
      debuggerKey: uploadSession.debuggerKey,
      debuggerContentEncoding: input.input.debuggerContentEncoding ?? null,
      debuggerSizeBytes: input.input.debuggerSizeBytes ?? null,
      debuggerUploadedAt,
      debuggerIngestionStatus: uploadSession.debuggerKey
        ? BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.pending
        : BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.notUploaded,
      submissionStatus: BUG_REPORT_SUBMISSION_STATUS_OPTIONS.processing,
      visibility: uploadSession.visibility,
      deviceInfo: uploadSession.deviceInfo,
      status: "open",
      metadata: uploadSession.metadata,
    })

    await tx
      .delete(bugReportUploadSession)
      .where(eq(bugReportUploadSession.id, uploadSession.id))
  })

  const debuggerPersistence = uploadSession.debuggerKey
    ? await finalizeBugReportDebuggerIngestion({
        bugReportId: uploadSession.id,
        organizationId: uploadSession.organizationId,
      })
    : createEmptyDebuggerPersistence()

  const warnings = [...debuggerPersistence.warnings]
  const submissionStatus =
    debuggerPersistence.warnings.length > 0 &&
    debuggerPersistence.persisted.actions === 0 &&
    debuggerPersistence.persisted.logs === 0 &&
    debuggerPersistence.persisted.networkRequests === 0 &&
    uploadSession.debuggerKey
      ? BUG_REPORT_SUBMISSION_STATUS_OPTIONS.failed
      : BUG_REPORT_SUBMISSION_STATUS_OPTIONS.ready

  await db
    .update(bugReport)
    .set({
      submissionStatus,
      updatedAt: new Date(),
    })
    .where(eq(bugReport.id, uploadSession.id))

  // Debugger ingestion is optional; the report is already persisted, so surface
  // the failed status instead of 500ing the whole submission.
  return {
    id: uploadSession.id,
    shareUrl: `/s/${uploadSession.id}`,
    submissionStatus,
    warnings,
    debugger: debuggerPersistence,
  }
}

async function finalizeBugReportDebuggerIngestion(input: {
  bugReportId: string
  organizationId: string
}): Promise<PersistBugReportDebuggerDataResult> {
  const { jobId } = await queueBugReportIngestionJob(input)
  const result = await processBugReportIngestionJob({ jobId })

  if (result.status === "completed") {
    return result.debugger
  }

  return createEmptyDebuggerPersistence([
    "Failed to process debugger data for this report.",
  ])
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
