import { authClient } from "@crikket/auth/client"
import { headers } from "next/headers"
import { cache } from "react"

export const getProtectedAuthData = cache(async () => {
  const requestHeaders = await headers()

  const { data: session } = await authClient.getSession({
    fetchOptions: {
      headers: requestHeaders,
    },
  })

  if (!session) {
    return {
      organizations: [],
      session: null,
    }
  }

  const { data: organizations } = await authClient.organization.list({
    fetchOptions: {
      headers: requestHeaders,
    },
  })

  return {
    organizations: organizations ?? [],
    session,
  }
})
