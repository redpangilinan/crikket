import {
  BUG_REPORT_STATUS_OPTIONS,
  BUG_REPORT_VISIBILITY_OPTIONS,
} from "@crikket/shared/constants/bug-report"
import { PRIORITY_OPTIONS } from "@crikket/shared/constants/priorities"
import * as z from "zod"

const statusValues = Object.values(BUG_REPORT_STATUS_OPTIONS) as [
  (typeof BUG_REPORT_STATUS_OPTIONS)[keyof typeof BUG_REPORT_STATUS_OPTIONS],
  ...(typeof BUG_REPORT_STATUS_OPTIONS)[keyof typeof BUG_REPORT_STATUS_OPTIONS][],
]

const priorityValues = Object.values(PRIORITY_OPTIONS) as [
  (typeof PRIORITY_OPTIONS)[keyof typeof PRIORITY_OPTIONS],
  ...(typeof PRIORITY_OPTIONS)[keyof typeof PRIORITY_OPTIONS][],
]

const visibilityValues = Object.values(BUG_REPORT_VISIBILITY_OPTIONS) as [
  (typeof BUG_REPORT_VISIBILITY_OPTIONS)[keyof typeof BUG_REPORT_VISIBILITY_OPTIONS],
  ...(typeof BUG_REPORT_VISIBILITY_OPTIONS)[keyof typeof BUG_REPORT_VISIBILITY_OPTIONS][],
]

const MAX_TAGS = 20
const MAX_TAG_LENGTH = 40

function parseTagInput(tagInput: string): string[] {
  return Array.from(
    new Set(
      tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  )
}

export const editBugReportFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or fewer"),
  tagsInput: z.string().superRefine((value, ctx) => {
    const tags = parseTagInput(value)
    if (tags.length > MAX_TAGS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Use ${MAX_TAGS} tags or fewer`,
      })
      return
    }

    const hasLongTag = tags.some((tag) => tag.length > MAX_TAG_LENGTH)
    if (hasLongTag) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Each tag must be ${MAX_TAG_LENGTH} characters or fewer`,
      })
    }
  }),
  status: z.enum(statusValues),
  priority: z.enum(priorityValues),
  assigneeId: z.string().min(1).nullable(),
  visibility: z.enum(visibilityValues),
})
