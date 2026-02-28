import { getOrganizationEntitlements } from "@crikket/billing/service/entitlements/organization-entitlements"
import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { retryOnUniqueViolation } from "@crikket/shared/lib/server/retry-on-unique-violation"
import { ORPCError } from "@orpc/server"
import { nanoid } from "nanoid"
import { z } from "zod"
import { assertAttachmentIsSupported } from "./attachment-validation"
import {
  bugReportDebuggerInputSchema,
  type PersistBugReportDebuggerDataResult,
  persistBugReportDebuggerData,
} from "./debugger"
import {
  generateFilename,
  getStorageProvider,
  isExpiringSignedUrl,
  removeAttachmentEventually,
  runAttachmentCleanupPass,
} from "./storage"
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

export const createBugReportInputSchema = z.object({
  title: optionalText(200),
  description: optionalText(3000),
  priority: z.enum(priorityValues).default(PRIORITY_OPTIONS.none),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
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

type CreateBugReportInput = z.infer<typeof createBugReportInputSchema>

type CreateBugReportEntitlementInput = {
  attachmentType: "video" | "screenshot"
  metadata?: {
    durationMs?: number
  }
}

export interface CreateBugReportRecordInput {
  input: CreateBugReportInput
  organizationId: string
  reporterId?: string | null
  tags?: string[] | undefined
}

async function assertCreateBugReportEntitlements(input: {
  organizationId: string
  payload: CreateBugReportEntitlementInput
}): Promise<void> {
  const entitlements = await getOrganizationEntitlements(input.organizationId)

  if (!entitlements.canCreateBugReports) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "This organization is on the free plan. Upgrade to Pro to create bug reports.",
    })
  }

  if (input.payload.attachmentType !== "video") {
    return
  }

  if (!entitlements.canUploadVideo) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "Video uploads are not available for this organization plan. Upgrade to Pro to continue.",
    })
  }

  if (typeof entitlements.maxVideoDurationMs !== "number") {
    return
  }

  const durationMs = input.payload.metadata?.durationMs
  if (typeof durationMs !== "number") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Video duration metadata is required for video uploads.",
    })
  }

  if (durationMs > entitlements.maxVideoDurationMs) {
    throw new ORPCError("FORBIDDEN", {
      message: "Video exceeds your organization plan duration limit.",
    })
  }
}

export async function createBugReportRecord({
  input,
  organizationId,
  reporterId,
  tags,
}: CreateBugReportRecordInput): Promise<{
  debugger: PersistBugReportDebuggerDataResult
  id: string
  shareUrl: string
  warnings: string[]
}> {
  await assertCreateBugReportEntitlements({
    organizationId,
    payload: {
      attachmentType: input.attachmentType,
      metadata: {
        durationMs: input.metadata?.durationMs,
      },
    },
  })
  await assertAttachmentIsSupported({
    attachment: input.attachment,
    attachmentType: input.attachmentType,
  })

  const storage = getStorageProvider()
  const filename = generateFilename(input.attachmentType)

  try {
    await storage.save(filename, input.attachment)
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
    pageTitle: input.metadata?.pageTitle,
    sdkVersion: input.metadata?.sdkVersion,
    submittedVia: input.metadata?.submittedVia,
    thumbnailUrl:
      input.metadata?.thumbnailUrl &&
      !isExpiringSignedUrl(input.metadata.thumbnailUrl)
        ? input.metadata.thumbnailUrl
        : undefined,
  }

  const inferredTitle =
    input.title ??
    input.metadata?.pageTitle?.trim() ??
    buildFallbackTitle(input.attachmentType)

  let id: string
  try {
    const result = await retryOnUniqueViolation(async () => {
      const generatedId = nanoid(12)

      await db.insert(bugReport).values({
        id: generatedId,
        organizationId,
        reporterId: reporterId ?? null,
        title: inferredTitle,
        description: input.description,
        priority: input.priority,
        tags,
        url: input.url,
        attachmentUrl: null,
        attachmentKey: filename,
        attachmentType: input.attachmentType,
        visibility: input.visibility,
        deviceInfo: input.deviceInfo,
        status: "open",
        metadata: normalizedMetadata,
      })

      return { id: generatedId }
    })
    id = result.id
  } catch (error) {
    await removeAttachmentEventually(filename)

    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message:
        "Failed to persist bug report after uploading attachment. The attachment has been scheduled for cleanup.",
      cause: error,
    })
  }

  let debuggerPersistence: PersistBugReportDebuggerDataResult
  try {
    debuggerPersistence = await persistBugReportDebuggerData(id, input.debugger)
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

  await runAttachmentCleanupPass({ limit: 5 })

  return {
    id,
    shareUrl: `/s/${id}`,
    warnings: debuggerPersistence.warnings,
    debugger: debuggerPersistence,
  }
}
