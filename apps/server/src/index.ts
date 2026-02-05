import { createContext } from "@crikket/api/context"
import { appRouter } from "@crikket/api/routers/index"
import { auth } from "@crikket/auth"
import { env } from "@crikket/env/server"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins"
import { onError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

const app = new Hono()

app.use(logger())
app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (origin === env.CORS_ORIGIN) return origin
      if (origin.startsWith("chrome-extension://")) return origin
      return env.CORS_ORIGIN
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
)

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c })

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context,
  })

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response)
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context,
  })

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response)
  }

  await next()
})

app.get("/", (c) => {
  return c.text("OK")
})

export default app
