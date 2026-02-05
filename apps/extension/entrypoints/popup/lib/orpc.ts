import type { AppRouterClient } from "@crikket/api/routers/index"

import { env } from "@crikket/env/extension"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"

/**
 * Extension-specific ORPC client
 * Simplified version without Next.js dependencies since extensions run only in browser context
 */
export const link = new RPCLink({
  url: `${env.VITE_SERVER_URL}/rpc`,
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    })
  },
})

export const client: AppRouterClient = createORPCClient(link)
