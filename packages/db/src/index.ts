import { env } from "@crikket/env/server"
import { drizzle } from "drizzle-orm/node-postgres"

import * as schema from "./schema"

export const db = drizzle(env.DATABASE_URL, { schema })
