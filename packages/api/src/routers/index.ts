import type { RouterClient } from "@orpc/server"

import { protectedProcedure, publicProcedure } from "../index"

import { authRouter } from "./auth"
import { bugReportRouter } from "./bug-report"

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK"
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    }
  }),
  auth: authRouter,
  bugReport: bugReportRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
