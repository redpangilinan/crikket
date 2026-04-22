import { ORPCError } from "@orpc/server"
import { z } from "zod"
import {
  deleteGithubIntegration,
  getGithubIntegrationSummary,
  upsertGithubIntegration,
} from "../lib/github-integration-config"
import { protectedProcedure } from "./context"
import { requireActiveOrgAdmin } from "./helpers"

const repoSchema = z
  .string()
  .trim()
  .regex(/^[^/\s]+\/[^/\s]+$/, { message: "Expected owner/repo" })

const upsertInputSchema = z.object({
  repo: repoSchema,
  // Empty string = "don't change the stored token". Non-empty = replace.
  token: z.string().optional(),
})

export const getIntegration = protectedProcedure.handler(async ({ context }) => {
  const organizationId = await requireActiveOrgAdmin(context.session)
  return getGithubIntegrationSummary(organizationId)
})

export const upsertIntegration = protectedProcedure
  .input(upsertInputSchema)
  .handler(async ({ context, input }) => {
    const organizationId = await requireActiveOrgAdmin(context.session)
    const trimmedToken =
      input.token && input.token.trim().length > 0 ? input.token.trim() : undefined

    try {
      await upsertGithubIntegration({
        organizationId,
        repo: input.repo,
        token: trimmedToken,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save GitHub integration."
      throw new ORPCError("BAD_REQUEST", { message })
    }

    return getGithubIntegrationSummary(organizationId)
  })

export const removeIntegration = protectedProcedure.handler(
  async ({ context }) => {
    const organizationId = await requireActiveOrgAdmin(context.session)
    await deleteGithubIntegration(organizationId)
    return { ok: true }
  }
)
