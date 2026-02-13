import { ORPCError, os } from "@orpc/server"

import type { SessionContext } from "../utils"

const o = os.$context<{ session?: SessionContext }>()

const requireAuth = o.middleware(({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED")
  }

  return next({
    context: {
      session: context.session,
    },
  })
})

export const protectedProcedure = o.use(requireAuth)
export { o }
