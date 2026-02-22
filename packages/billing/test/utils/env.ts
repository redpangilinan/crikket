export function ensureBillingTestEnv(): void {
  process.env.DATABASE_URL ??=
    "postgres://postgres:postgres@localhost:5432/test"
  process.env.BETTER_AUTH_SECRET ??= "01234567890123456789012345678901"
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000"
  Object.assign(process.env, { NODE_ENV: "development" })
}
