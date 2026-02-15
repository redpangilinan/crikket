import { createSessionProcedures } from "@crikket/shared/lib/server/orpc-auth"
import type { auth } from "../index"

export type SessionContext = typeof auth.$Infer.Session

const { protectedProcedure } = createSessionProcedures<SessionContext>({
  isAuthorized: (session) => Boolean(session?.user),
})

export { protectedProcedure }
