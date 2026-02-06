import { z } from "zod"
import { paginationConfig } from "../../config/pagination"

const paginationParamsBaseSchema = z.object({
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().optional(),
})

export const paginationParamsSchema = paginationParamsBaseSchema.optional()

export type PaginationParams = z.infer<typeof paginationParamsSchema>

export interface PaginationMeta {
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  totalItems: number
}

export interface PaginatedResult<TItem> {
  items: TItem[]
  pagination: PaginationMeta
}

export function normalizePaginationParams(
  params: PaginationParams | undefined
): { page: number; perPage: number; offset: number; limit: number } {
  const rawPage = params?.page ?? paginationConfig.defaultPage
  const rawPerPage = params?.perPage ?? paginationConfig.defaultPageSize

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
  const perPage =
    Number.isFinite(rawPerPage) && rawPerPage > 0
      ? Math.floor(rawPerPage)
      : paginationConfig.defaultPageSize

  const offset = (page - 1) * perPage

  return {
    page,
    perPage,
    offset,
    limit: perPage,
  }
}

export function buildPaginationMeta(
  totalCount: number,
  page: number,
  perPage: number
): PaginationMeta {
  const safeTotal =
    Number.isFinite(totalCount) && totalCount >= 0 ? totalCount : 0
  const pageCount =
    perPage > 0 ? Math.max(1, Math.ceil(safeTotal / perPage)) : 1

  const currentPage = Math.min(Math.max(page, 1), pageCount)

  return {
    page: currentPage,
    pageSize: perPage,
    totalItems: safeTotal,
    totalPages: pageCount,
    hasNextPage: currentPage < pageCount,
    hasPrevPage: currentPage > 1,
  }
}
