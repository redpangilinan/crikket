"use client"

import type { BugReportSort } from "@crikket/shared/constants/bug-report"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"

import { orpc } from "@/utils/orpc"
import type { DashboardFilters } from "../_components/bug-reports/filters"

const PAGE_SIZE = 12

interface UseBugReportsDataInput {
  search: string
  sort: BugReportSort
  filters: DashboardFilters
}

export function useBugReportsData({
  search,
  sort,
  filters,
}: UseBugReportsDataInput) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const query = useInfiniteQuery(
    orpc.bugReport.list.infiniteOptions({
      initialPageParam: 1,
      input: (pageParam) => ({
        page: pageParam,
        perPage: PAGE_SIZE,
        search: search || undefined,
        sort,
        statuses: filters.statuses.length > 0 ? filters.statuses : undefined,
        priorities:
          filters.priorities.length > 0 ? filters.priorities : undefined,
        visibilities:
          filters.visibilities.length > 0 ? filters.visibilities : undefined,
      }),
      getNextPageParam: (lastPage) =>
        lastPage.pagination.hasNextPage
          ? lastPage.pagination.page + 1
          : undefined,
    })
  )

  const statsQuery = useQuery(orpc.bugReport.getDashboardStats.queryOptions())

  const reports = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data]
  )

  useEffect(() => {
    const target = loadMoreRef.current
    if (!(target && query.hasNextPage) || query.isFetchingNextPage) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          query.fetchNextPage()
        }
      },
      { rootMargin: "300px 0px" }
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage])

  const refetchAll = async () => {
    await Promise.all([query.refetch(), statsQuery.refetch()])
  }

  return {
    loadMoreRef,
    reports,
    stats: statsQuery.data,
    refetchAll,
    query,
  }
}
