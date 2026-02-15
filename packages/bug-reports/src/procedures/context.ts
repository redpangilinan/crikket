import { createSessionProcedures } from "@crikket/shared/lib/server/orpc-auth"

import type { SessionContext } from "../utils"

const { o, protectedProcedure } = createSessionProcedures<SessionContext>({
  isAuthorized: (session) => Boolean(session?.user),
})

export { o, protectedProcedure }
