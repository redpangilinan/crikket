import "dotenv/config"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    POLAR_ACCESS_TOKEN: z.string().min(1).optional(),
    POLAR_SUCCESS_URL: z.url().optional(),
    POLAR_WEBHOOK_SECRET: z.string().min(1).optional(),
    POLAR_PRODUCT_ID: z.string().min(1).optional(),
    CORS_ORIGIN: z.url(),
    ENABLE_PAYMENTS: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    STORAGE_PATH: z.string().min(1).default("./uploads"),
    NODE_ENV: z
      .enum(["development", "production", "staging"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
