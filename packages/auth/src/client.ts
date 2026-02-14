import { env } from "@crikket/env/web"
import { polarClient } from "@polar-sh/better-auth"
import {
  adminClient,
  emailOTPClient,
  organizationClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  plugins: [
    adminClient(),
    emailOTPClient(),
    organizationClient(),
    polarClient(),
  ],
})
