import { db } from "@crikket/db"
import { organizationGithubIntegration } from "@crikket/db/schema/github-integration"
import { env } from "@crikket/env/server"
import { decryptSecret, encryptSecret } from "@crikket/shared/lib/server/crypto"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"

export interface GithubIntegrationSummary {
  configured: boolean
  repo: string | null
}

export interface GithubIntegrationCredentials {
  repo: string
  token: string
}

export async function getGithubIntegrationSummary(
  organizationId: string
): Promise<GithubIntegrationSummary> {
  const row = await db.query.organizationGithubIntegration.findFirst({
    where: eq(organizationGithubIntegration.organizationId, organizationId),
    columns: { repo: true },
  })
  if (!row) return { configured: false, repo: null }
  return { configured: true, repo: row.repo }
}

export async function getGithubIntegrationCredentials(
  organizationId: string
): Promise<GithubIntegrationCredentials | null> {
  const row = await db.query.organizationGithubIntegration.findFirst({
    where: eq(organizationGithubIntegration.organizationId, organizationId),
    columns: { repo: true, tokenEncrypted: true },
  })
  if (!row) return null
  try {
    const token = decryptSecret(row.tokenEncrypted, env.BETTER_AUTH_SECRET)
    return { repo: row.repo, token }
  } catch {
    // Encrypted blob unreadable (corrupted row or key rotated). Treat as unconfigured.
    return null
  }
}

export async function upsertGithubIntegration(input: {
  organizationId: string
  repo: string
  /** If undefined, preserves the existing token. Required when no row exists yet. */
  token?: string
}): Promise<void> {
  const existing = await db.query.organizationGithubIntegration.findFirst({
    where: eq(
      organizationGithubIntegration.organizationId,
      input.organizationId
    ),
    columns: { id: true, tokenEncrypted: true },
  })

  if (!existing) {
    if (!input.token) {
      throw new Error("Token is required to create a GitHub integration.")
    }
    await db.insert(organizationGithubIntegration).values({
      id: nanoid(16),
      organizationId: input.organizationId,
      repo: input.repo,
      tokenEncrypted: encryptSecret(input.token, env.BETTER_AUTH_SECRET),
    })
    return
  }

  const nextTokenEncrypted = input.token
    ? encryptSecret(input.token, env.BETTER_AUTH_SECRET)
    : existing.tokenEncrypted

  await db
    .update(organizationGithubIntegration)
    .set({
      repo: input.repo,
      tokenEncrypted: nextTokenEncrypted,
      updatedAt: new Date(),
    })
    .where(eq(organizationGithubIntegration.id, existing.id))
}

export async function deleteGithubIntegration(
  organizationId: string
): Promise<void> {
  await db
    .delete(organizationGithubIntegration)
    .where(eq(organizationGithubIntegration.organizationId, organizationId))
}
