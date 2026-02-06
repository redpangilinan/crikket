import { auth } from "@crikket/auth"
import type { Context as HonoContext } from "hono"

export type CreateContextOptions = {
  context: HonoContext
}

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  })
  return {
    session: session ?? undefined,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
