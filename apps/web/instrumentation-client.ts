import { init } from "@crikket/capture"
import { env } from "@crikket/env/web"
import { initPostHog } from "@crikket/shared/lib/posthog"

if (env.NEXT_PUBLIC_CRIKKET_KEY) {
  init({
    key: env.NEXT_PUBLIC_CRIKKET_KEY,
    host: env.NEXT_PUBLIC_SERVER_URL,
  })
}

initPostHog({
  key: env.NEXT_PUBLIC_POSTHOG_KEY,
  host: env.NEXT_PUBLIC_POSTHOG_HOST,
})
