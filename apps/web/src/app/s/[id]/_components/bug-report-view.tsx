"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"

import { orpc } from "@/utils/orpc"

interface BugReportViewProps {
  id: string
}

export function BugReportView({ id }: BugReportViewProps) {
  const { data, isLoading, error } = useQuery(
    orpc.bugReport.getById.queryOptions({
      input: { id },
      enabled: Boolean(id),
    })
  )

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h1 className="font-semibold text-xl">Bug report not found</h1>
              <p className="text-muted-foreground text-sm">
                This share link is invalid or the report was removed.
              </p>
            </div>
            <Link
              className="font-medium text-primary text-sm underline"
              href="/"
            >
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const showVideo =
    data.attachmentType === "video" && Boolean(data.attachmentUrl)
  const showImage =
    data.attachmentType === "screenshot" && Boolean(data.attachmentUrl)

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl">
          {data.title ?? "Untitled Bug Report"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Report ID: {data.id} • {new Date(data.createdAt).toLocaleString()}
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          {showVideo ? (
            <>
              {/* biome-ignore lint/a11y/useMediaCaption: uploaded bug recordings do not have caption tracks yet */}
              <video
                className="h-auto max-h-[70vh] w-full bg-black"
                controls
                src={data.attachmentUrl ?? undefined}
              />
            </>
          ) : null}

          {showImage ? (
            <img
              alt={data.title ?? "Bug report attachment"}
              className="h-auto w-full object-contain"
              src={data.attachmentUrl ?? undefined}
            />
          ) : null}

          {showVideo || showImage ? null : (
            <div className="flex min-h-[280px] items-center justify-center bg-muted p-6 text-center text-muted-foreground text-sm">
              No attachment available for this report.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Status:</span> {data.status}
            </p>
            <p>
              <span className="font-medium">Priority:</span> {data.priority}
            </p>
            <p>
              <span className="font-medium">Reporter:</span>{" "}
              {data.reporter?.name ?? "Unknown"}
            </p>
            <p>
              <span className="font-medium">Organization:</span>{" "}
              {data.organization.name}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="break-all">
              <span className="font-medium">URL:</span> {data.url ?? "N/A"}
            </p>
            <p>
              <span className="font-medium">Attachment Type:</span>{" "}
              {data.attachmentType ?? "N/A"}
            </p>
            <p className="text-muted-foreground">
              {data.description ?? "No description provided."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
