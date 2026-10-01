"use client"

import { authClient } from "@crikket/auth/client"
import { useQuery } from "@tanstack/react-query"

export function useAssigneeMembers(enabled = true) {
  const { data: session } = authClient.useSession()
  const organizationId = session?.session.activeOrganizationId
  const membersQuery = useQuery({
    queryKey: ["assignee-members", organizationId, session?.user.id],
    enabled: enabled && Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) {
        throw new Error("No active organization")
      }

      const firstPage = await authClient.organization.listMembers({
        query: {
          organizationId,
          limit: 100,
          offset: 0,
          sortBy: "id",
          sortDirection: "asc",
        },
      })
      if (firstPage.error || !firstPage.data) {
        throw new Error(firstPage.error?.message ?? "Failed to load members")
      }

      const members = [...firstPage.data.members]
      let total = firstPage.data.total
      while (members.length < total) {
        const nextPage = await authClient.organization.listMembers({
          query: {
            organizationId,
            limit: 100,
            offset: members.length,
            sortBy: "id",
            sortDirection: "asc",
          },
        })
        if (nextPage.error || !nextPage.data) {
          throw new Error(nextPage.error?.message ?? "Failed to load members")
        }
        if (nextPage.data.members.length === 0) {
          throw new Error("Member list changed. Please retry.")
        }
        members.push(...nextPage.data.members)
        total = nextPage.data.total
      }

      return members.sort((a, b) => a.user.name.localeCompare(b.user.name))
    },
  })

  return { organizationId, membersQuery }
}
