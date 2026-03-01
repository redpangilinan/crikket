import { init } from "@crikket/capture"
import { env } from "@crikket/env/web"
import { initPostHog } from "@crikket/shared/lib/posthog"

// hardcoded for testing purposes (this is a public key)
const CAPTURE_TEST_KEY = "crk_-yT2YC4XrNeswJPzEIXmkXf_"

init({
  key: CAPTURE_TEST_KEY,
  host: env.NEXT_PUBLIC_SERVER_URL,
})

initPostHog({
  key: env.NEXT_PUBLIC_POSTHOG_KEY,
  host: env.NEXT_PUBLIC_POSTHOG_HOST,
})
