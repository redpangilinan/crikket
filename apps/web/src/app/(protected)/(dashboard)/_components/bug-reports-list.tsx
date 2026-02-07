"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Button } from "@crikket/ui/components/ui/button"
import { Card, CardContent } from "@crikket/ui/components/ui/card"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Clock, Loader2, Play } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef } from "react"

import { orpc } from "@/utils/orpc"

const PAGE_SIZE = 12

export function BugReportsList() {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery(
    orpc.bugReport.list.infiniteOptions({
      initialPageParam: 1,
      input: (pageParam) => ({ page: pageParam, perPage: PAGE_SIZE }),
      getNextPageParam: (lastPage) =>
        lastPage.pagination.hasNextPage
          ? lastPage.pagination.page + 1
          : undefined,
    })
  )

  const reports = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  )

  useEffect(() => {
    const target = loadMoreRef.current
    if (!(target && hasNextPage) || isFetchingNextPage) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          fetchNextPage()
        }
      },
      { rootMargin: "300px 0px" }
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            className="aspect-video w-full animate-pulse rounded-lg bg-muted"
            key={i}
          />
        ))}
      </div>
    )
  }

  if (!data || reports.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Play className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="font-semibold text-2xl">No bug reports yet</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Start reporting bugs to see them here
          </p>
        </div>
        <Button className="mt-4" size="lg">
          Create your first bug report
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {reports.map((report) => (
          <Link href={`/s/${report.id}`} key={report.id}>
            <Card className="group overflow-hidden p-0 transition-all hover:shadow-lg">
              <CardContent className="p-0">
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {report.thumbnail ? (
                    <img
                      alt={report.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      src={report.thumbnail}
                    />
                  ) : report.attachmentType === "video" &&
                    report.attachmentUrl ? (
                    <>
                      <video
                        autoPlay
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loop
                        muted
                        playsInline
                        src={report.attachmentUrl}
                      />
                      <div className="absolute inset-0 bg-black/10" />
                    </>
                  ) : report.attachmentType === "screenshot" &&
                    report.attachmentUrl ? (
                    <img
                      alt={report.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      src={report.attachmentUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Play className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                  {/* Duration badge */}
                  {report.attachmentType === "video" ? (
                    <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-white text-xs">
                      <Clock className="h-3 w-3" />
                      {report.duration}
                    </div>
                  ) : null}
                </div>
                {/* Info */}
                <div className="flex items-start gap-3 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      alt={report.uploader.name}
                      src={report.uploader.avatar}
                    />
                    <AvatarFallback>
                      {report.uploader.name
                        ?.split(" ")
                        .map((namePart: string) => namePart[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <h3 className="line-clamp-1 font-semibold text-sm leading-tight">
                      {report.title}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {report.uploader.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {isFetching && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div aria-hidden className="h-1 w-full" ref={loadMoreRef} />
    </div>
  )
}
