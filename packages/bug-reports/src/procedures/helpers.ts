import { ORPCError } from "@orpc/server"

import type { SessionContext } from "../utils"

export function requireActiveOrgId(session: SessionContext): string {
  const activeOrgId = session.session.activeOrganizationId
  if (!activeOrgId) {
    throw new ORPCError("BAD_REQUEST", { message: "No active organization" })
  }

  return activeOrgId
}

export function normalizeTags(tags?: string[]): string[] | undefined {
  if (!tags) {
    return undefined
  }

  const uniqueTags = Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .map((tag) => tag.slice(0, 40))
    )
  )

  return uniqueTags.length > 0 ? uniqueTags : []
}
