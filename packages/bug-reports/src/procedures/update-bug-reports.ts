import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import { ORPCError } from "@orpc/server"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import {
  isStatus,
  isVisibility,
  statusValues,
  visibilityValues,
} from "../utils"
import { protectedProcedure } from "./context"
import { normalizeTags, requireActiveOrgId } from "./helpers"

const priorityValues = Object.values(PRIORITY_OPTIONS) as [
  Priority,
  ...Priority[],
]

const tagsInputSchema = z.array(z.string().trim().min(1).max(40)).max(20)

const bugReportUpdateInputSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(statusValues).optional(),
    priority: z.enum(priorityValues).optional(),
    visibility: z.enum(visibilityValues).optional(),
    tags: tagsInputSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.status === undefined &&
      value.priority === undefined &&
      value.visibility === undefined &&
      value.tags === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one update field is required",
      })
    }
  })

const bugReportBulkUpdateInputSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    status: z.enum(statusValues).optional(),
    priority: z.enum(priorityValues).optional(),
    visibility: z.enum(visibilityValues).optional(),
    tags: tagsInputSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.status === undefined &&
      value.priority === undefined &&
      value.visibility === undefined &&
      value.tags === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one update field is required",
      })
    }
  })

function buildUpdateValues(input: {
  status?: (typeof statusValues)[number]
  priority?: Priority
  visibility?: (typeof visibilityValues)[number]
  tags?: string[]
}) {
  const values: {
    status?: string
    priority?: string
    visibility?: string
    tags?: string[]
  } = {}

  if (input.status !== undefined) {
    values.status = input.status
  }

  if (input.priority !== undefined) {
    values.priority = input.priority
  }

  if (input.visibility !== undefined) {
    values.visibility = input.visibility
  }

  if (input.tags !== undefined) {
    values.tags = normalizeTags(input.tags) ?? []
  }

  return values
}

export const updateBugReport = protectedProcedure
  .input(bugReportUpdateInputSchema)
  .handler(async ({ context, input }) => {
    const activeOrgId = requireActiveOrgId(context.session)
    const values = buildUpdateValues(input)

    const updated = await db
      .update(bugReport)
      .set(values)
      .where(
        and(
          eq(bugReport.id, input.id),
          eq(bugReport.organizationId, activeOrgId)
        )
      )
      .returning({
        id: bugReport.id,
        status: bugReport.status,
        priority: bugReport.priority,
        visibility: bugReport.visibility,
        tags: bugReport.tags,
      })

    const report = updated[0]
    if (!report) {
      throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
    }

    return {
      id: report.id,
      status: isStatus(report.status) ? report.status : statusValues[0],
      priority: priorityValues.includes(report.priority as Priority)
        ? (report.priority as Priority)
        : PRIORITY_OPTIONS.none,
      visibility: isVisibility(report.visibility)
        ? report.visibility
        : visibilityValues[1],
      tags: Array.isArray(report.tags) ? report.tags : [],
    }
  })

export const updateBugReportsBulk = protectedProcedure
  .input(bugReportBulkUpdateInputSchema)
  .handler(async ({ context, input }) => {
    const activeOrgId = requireActiveOrgId(context.session)
    const values = buildUpdateValues(input)
    const uniqueIds = Array.from(new Set(input.ids))

    const updated = await db
      .update(bugReport)
      .set(values)
      .where(
        and(
          eq(bugReport.organizationId, activeOrgId),
          inArray(bugReport.id, uniqueIds)
        )
      )
      .returning({ id: bugReport.id })

    return {
      updatedCount: updated.length,
      ids: updated.map((row) => row.id),
    }
  })

export const updateBugReportVisibility = protectedProcedure
  .input(
    z.object({
      id: z.string().min(1),
      visibility: z.enum(visibilityValues),
    })
  )
  .handler(async ({ context, input }) => {
    const activeOrgId = requireActiveOrgId(context.session)

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
        : visibilityValues[1],
    }
  })
