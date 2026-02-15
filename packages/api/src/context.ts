import { auth } from "@crikket/auth"
import { db } from "@crikket/db"
import { session as authSession, member } from "@crikket/db/schema/auth"
import { asc, eq } from "drizzle-orm"
import type { Context as HonoContext } from "hono"

export type CreateContextOptions = {
  context: HonoContext
}

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  })

  const sessionId = session?.session.id
  const userId = session?.user.id

  if (session && userId && !session.session.activeOrganizationId) {
    const [fallbackMembership] = await db
      .select({
        organizationId: member.organizationId,
      })
      .from(member)
      .where(eq(member.userId, userId))
      .orderBy(asc(member.createdAt))
      .limit(1)

    const fallbackOrganizationId = fallbackMembership?.organizationId

    if (fallbackOrganizationId) {
      session.session.activeOrganizationId = fallbackOrganizationId

      if (sessionId) {
        await db
          .update(authSession)
          .set({
            activeOrganizationId: fallbackOrganizationId,
          })
          .where(eq(authSession.id, sessionId))
      }
    }
  }

  return {
    session: session ?? undefined,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
