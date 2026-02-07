import type { AppRouterClient } from "@crikket/api/routers/index"
import { env } from "@crikket/env/web"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { Metadata } from "next"
import type { ReactNode } from "react"

interface BugReportLayoutProps {
  children: ReactNode
  params: Promise<{ id: string }>
}

const link = new RPCLink({
  url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    })
  },
})

const client: AppRouterClient = createORPCClient(link)

export async function generateMetadata({
  params,
}: Pick<BugReportLayoutProps, "params">): Promise<Metadata> {
  const { id } = await params

  if (!id) {
    return { title: "Bug Report" }
  }

  try {
    const report = await client.bugReport.getById({ id })

    if (!report) {
      return { title: "Bug Report" }
    }

    return {
      title: report.title?.trim() || `Bug Report ${id}`,
    }
  } catch {
    return { title: "Bug Report" }
  }
}

export default function BugReportLayout({ children }: BugReportLayoutProps) {
  return children
}
