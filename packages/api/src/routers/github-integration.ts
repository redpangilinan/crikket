import {
  getIntegration,
  removeIntegration,
  upsertIntegration,
} from "@crikket/bug-reports/procedures/github-integration"

/**
 * GitHub Integration Router
 * Per-organization config for forwarding bug reports to a GitHub repo.
 */
export const githubIntegrationRouter = {
  get: getIntegration,
  upsert: upsertIntegration,
  remove: removeIntegration,
}
