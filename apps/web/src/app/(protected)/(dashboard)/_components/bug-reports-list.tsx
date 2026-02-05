"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Button } from "@crikket/ui/components/ui/button"
import { Card, CardContent } from "@crikket/ui/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { useQuery } from "@tanstack/react-query"
import { Clock, MoreVertical, Play } from "lucide-react"

import { orpc } from "@/utils/orpc"

export function BugReportsList() {
  const { data: bugReports, isLoading } = useQuery(
    orpc.bugReport.list.queryOptions()
  )

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

  if (!bugReports || bugReports.length === 0) {
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {bugReports.map((report) => (
        <Card
          className="group overflow-hidden transition-all hover:shadow-lg"
          key={report.id}
        >
          <CardContent className="p-0">
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden bg-muted">
              {report.thumbnail ? (
                <img
                  alt={report.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  src={report.thumbnail}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Play className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                  <Play className="h-6 w-6 fill-black text-black" />
                </div>
              </div>
              {/* Duration badge */}
              <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-white text-xs">
                <Clock className="h-3 w-3" />
                {report.duration}
              </div>
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
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <h3 className="line-clamp-2 font-semibold text-sm leading-tight">
                  {report.title}
                </h3>
                <p className="text-muted-foreground text-xs">
                  {report.uploader.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(report.createdAt).toLocaleDateString()}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button
                    className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                    size="icon"
                    variant="ghost"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Share</DropdownMenuItem>
                  <DropdownMenuItem>Download</DropdownMenuItem>
                  <DropdownMenuItem>Rename</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
