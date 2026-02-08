import type { AppRouterClient } from "@crikket/api/routers/index"
import { env } from "@crikket/env/web"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { Metadata } from "next"
import { headers } from "next/headers"
import type { ReactNode } from "react"

interface BugReportLayoutProps {
  children: ReactNode
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: Pick<BugReportLayoutProps, "params">): Promise<Metadata> {
  const { id } = await params

  if (!id) {
    return { title: "Bug Report" }
  }

  try {
    const link = new RPCLink({
      url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        })
      },
      headers: async () => {
        const requestHeaders = await headers()
        return Object.fromEntries(requestHeaders)
      },
    })
    const client: AppRouterClient = createORPCClient(link)
    const report = await client.bugReport.getById({ id })

    if (!report) {
      return { title: "Bug Report" }
    }

    return {
      title: report.title?.trim() || `Bug Report ${id}`,
    }
  } catch (error) {
    reportNonFatalError(
      `Failed to generate metadata for bug report ${id}`,
      error
    )
    return { title: "Bug Report" }
  }
}

export default function BugReportLayout({ children }: BugReportLayoutProps) {
  return children
}
