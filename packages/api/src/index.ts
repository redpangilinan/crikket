import { createSessionProcedures } from "@crikket/shared/lib/server/orpc-auth"

import type { Context } from "./context"

const { o, protectedProcedure, publicProcedure } = createSessionProcedures<
  NonNullable<Context["session"]>
>({
  isAuthorized: (session) => Boolean(session?.user),
})

export { o, protectedProcedure, publicProcedure }
