import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import {
  BUG_REPORT_SORT_OPTIONS,
  type BugReportSort,
} from "@crikket/shared/constants/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import {
  buildPaginationMeta,
  type PaginatedResult,
} from "@crikket/shared/lib/server/pagination"
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { z } from "zod"

import {
  formatDurationMs,
  isAttachmentType,
  isStatus,
  isVisibility,
  statusValues,
  visibilityValues,
} from "../utils"
import { protectedProcedure } from "./context"
import { requireActiveOrgId } from "./helpers"

const priorityValues = Object.values(PRIORITY_OPTIONS) as [
  Priority,
  ...Priority[],
]
const sortValues = Object.values(BUG_REPORT_SORT_OPTIONS) as [
  BugReportSort,
  ...BugReportSort[],
]
const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 50

export interface BugReportListItem {
  id: string
  title: string
  description: string | undefined
  duration: string
  thumbnail: string | undefined
  attachmentUrl: string | undefined
  attachmentType: "video" | "screenshot" | undefined
  uploader: {
    name: string
    avatar: string | undefined
  }
  visibility: "public" | "private"
  status: (typeof statusValues)[number]
  priority: Priority
  tags: string[]
  url: string | undefined
  createdAt: string
  updatedAt: string
}

export interface BugReportDashboardStats {
  total: number
  open: number
  inProgress: number
  resolved: number
  closed: number
  untriaged: number
  mine: number
  privateCount: number
  publicCount: number
}

const listBugReportsInputSchema = z
  .object({
    page: z.number().int().positive().optional(),
    perPage: z.number().int().positive().optional(),
    search: z
      .string()
      .max(200)
      .transform((value) => value.trim())
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    statuses: z.array(z.enum(statusValues)).max(statusValues.length).optional(),
    priorities: z
      .array(z.enum(priorityValues))
      .max(priorityValues.length)
      .optional(),
    visibilities: z
      .array(z.enum(visibilityValues))
      .max(visibilityValues.length)
      .optional(),
    sort: z.enum(sortValues).default(BUG_REPORT_SORT_OPTIONS.newest),
  })
  .optional()

function normalizePagination(input: z.infer<typeof listBugReportsInputSchema>) {
  const rawPage = input?.page ?? DEFAULT_PAGE
  const rawPerPage = input?.perPage ?? DEFAULT_PAGE_SIZE
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
  const perPage = Number.isFinite(rawPerPage)
    ? Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(rawPerPage)))
    : DEFAULT_PAGE_SIZE

  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
    limit: perPage,
  }
}

function buildOrderBy(sort: BugReportSort) {
  const priorityWeight = sql<number>`
    CASE
      WHEN ${bugReport.priority} = 'critical' THEN 0
      WHEN ${bugReport.priority} = 'high' THEN 1
      WHEN ${bugReport.priority} = 'medium' THEN 2
      WHEN ${bugReport.priority} = 'low' THEN 3
      ELSE 4
    END
  `

  if (sort === BUG_REPORT_SORT_OPTIONS.oldest) {
    return [asc(bugReport.createdAt)]
  }

  if (sort === BUG_REPORT_SORT_OPTIONS.updated) {
    return [desc(bugReport.updatedAt)]
  }

  if (sort === BUG_REPORT_SORT_OPTIONS.priorityHigh) {
    return [asc(priorityWeight), desc(bugReport.createdAt)]
  }

  if (sort === BUG_REPORT_SORT_OPTIONS.priorityLow) {
    return [desc(priorityWeight), desc(bugReport.createdAt)]
  }

  return [desc(bugReport.createdAt)]
}

function normalizeInt(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0)
}

function normalizePriority(value: unknown): Priority {
  return priorityValues.includes(value as Priority)
    ? (value as Priority)
    : PRIORITY_OPTIONS.none
}

function normalizeDuration(metadata: Record<string, unknown> | null): string {
  const duration = metadata?.duration
  if (typeof duration === "string" && duration.length > 0) {
    return duration
  }

  const durationMs = metadata?.durationMs
  if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
    return formatDurationMs(Math.max(0, Math.floor(durationMs)))
  }

  return "0:00"
}

interface BugReportListRecord {
  id: string
  title: string | null
  description: string | null
  metadata: unknown
  attachmentUrl: string | null
  attachmentType: string | null
  visibility: string
  status: string
  priority: string
  tags: string[] | null
  url: string | null
  createdAt: Date
  updatedAt: Date
  reporter: {
    name: string | null
    image: string | null
  } | null
}

function mapBugReportListItem(report: BugReportListRecord): BugReportListItem {
  const metadata = report.metadata as Record<string, unknown> | null
  const attachmentType = isAttachmentType(report.attachmentType)
    ? report.attachmentType
    : undefined

  return {
    id: report.id,
    title: report.title || "Untitled Bug Report",
    description: report.description ?? undefined,
    duration: normalizeDuration(metadata),
    thumbnail:
      (metadata?.thumbnailUrl as string | undefined) ??
      (attachmentType === "screenshot"
        ? (report.attachmentUrl ?? undefined)
        : undefined),
    attachmentUrl: report.attachmentUrl ?? undefined,
    attachmentType,
    visibility: isVisibility(report.visibility) ? report.visibility : "private",
    status: isStatus(report.status) ? report.status : "open",
    priority: normalizePriority(report.priority),
    tags: Array.isArray(report.tags) ? report.tags : [],
    url: report.url ?? undefined,
    uploader: {
      name: report.reporter?.name || "Unknown User",
      avatar: report.reporter?.image ?? undefined,
    },
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  }
}

export const listBugReports = protectedProcedure
  .input(listBugReportsInputSchema)
  .handler(
    async ({ context, input }): Promise<PaginatedResult<BugReportListItem>> => {
      const activeOrgId = requireActiveOrgId(context.session)
      const { page, perPage, offset, limit } = normalizePagination(input)

      const filters = [eq(bugReport.organizationId, activeOrgId)]

      if (input?.search) {
        const searchValue = `%${input.search}%`
        const searchCondition = or(
          ilike(bugReport.title, searchValue),
          ilike(bugReport.description, searchValue),
          ilike(bugReport.url, searchValue)
        )
        if (searchCondition) {
          filters.push(searchCondition)
        }
      }

      if (input?.statuses && input.statuses.length > 0) {
        filters.push(
          inArray(bugReport.status, Array.from(new Set(input.statuses)))
        )
      }

      if (input?.priorities && input.priorities.length > 0) {
        filters.push(
          inArray(bugReport.priority, Array.from(new Set(input.priorities)))
        )
      }

      if (input?.visibilities && input.visibilities.length > 0) {
        filters.push(
          inArray(bugReport.visibility, Array.from(new Set(input.visibilities)))
        )
      }

      const whereClause =
        filters.length === 1 ? filters[0] : (and(...filters) ?? filters[0])
      const orderBy = buildOrderBy(
        input?.sort ?? BUG_REPORT_SORT_OPTIONS.newest
      )

      const [countResult, bugReports] = await Promise.all([
        db.select({ value: count() }).from(bugReport).where(whereClause),
        db.query.bugReport.findMany({
          where: whereClause,
          orderBy,
          limit,
          offset,
          with: {
            reporter: true,
          },
        }),
      ])

      const totalCount = countResult[0]?.value ?? 0

      const items = bugReports.map((report) =>
        mapBugReportListItem(report as BugReportListRecord)
      )

      return {
        items,
        pagination: buildPaginationMeta(totalCount, page, perPage),
      }
    }
  )

export const getBugReportDashboardStats = protectedProcedure.handler(
  async ({ context }): Promise<BugReportDashboardStats> => {
    const activeOrgId = requireActiveOrgId(context.session)

    const [result] = await db
      .select({
        total: count(),
        open: sql<number>`SUM(CASE WHEN ${bugReport.status} = 'open' THEN 1 ELSE 0 END)`,
        inProgress: sql<number>`SUM(CASE WHEN ${bugReport.status} = 'in_progress' THEN 1 ELSE 0 END)`,
        resolved: sql<number>`SUM(CASE WHEN ${bugReport.status} = 'resolved' THEN 1 ELSE 0 END)`,
        closed: sql<number>`SUM(CASE WHEN ${bugReport.status} = 'closed' THEN 1 ELSE 0 END)`,
        untriaged: sql<number>`SUM(CASE WHEN ${bugReport.priority} = 'none' THEN 1 ELSE 0 END)`,
        mine: sql<number>`SUM(CASE WHEN ${bugReport.reporterId} = ${context.session.user.id} THEN 1 ELSE 0 END)`,
        privateCount: sql<number>`SUM(CASE WHEN ${bugReport.visibility} = 'private' THEN 1 ELSE 0 END)`,
        publicCount: sql<number>`SUM(CASE WHEN ${bugReport.visibility} = 'public' THEN 1 ELSE 0 END)`,
      })
      .from(bugReport)
      .where(eq(bugReport.organizationId, activeOrgId))

    return {
      total: normalizeInt(result?.total),
      open: normalizeInt(result?.open),
      inProgress: normalizeInt(result?.inProgress),
      resolved: normalizeInt(result?.resolved),
      closed: normalizeInt(result?.closed),
      untriaged: normalizeInt(result?.untriaged),
      mine: normalizeInt(result?.mine),
      privateCount: normalizeInt(result?.privateCount),
      publicCount: normalizeInt(result?.publicCount),
    }
  }
)
