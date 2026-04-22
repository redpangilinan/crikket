import type { RouterClient } from "@orpc/server"

import { publicProcedure } from "../index"

import { authRouter } from "./auth"
import { billingRouter } from "./billing"
import { bugReportRouter } from "./bug-report"
import { captureKeyRouter } from "./capture-key"
import { githubIntegrationRouter } from "./github-integration"

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK"
  }),
  auth: authRouter,
  billing: billingRouter,
  bugReport: bugReportRouter,
  captureKey: captureKeyRouter,
  githubIntegration: githubIntegrationRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
