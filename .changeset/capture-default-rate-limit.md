---
"server": patch
---

Rate limit the capture API by default, even when Upstash Redis is not configured.

Previously the capture rate limiter and submit-token replay protection only engaged when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` were set — so a self-hosted single instance ran the public capture endpoints with rate limiting entirely off.

The limiter and single-use nonce store now fall back to an in-process fixed-window implementation when no external Redis is configured, so a single instance is protected out of the box. Upstash remains the backend when configured, sharing limits and replay protection across horizontally scaled instances.
