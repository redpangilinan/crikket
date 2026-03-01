import { env } from "@crikket/env/web"
import type { MetadataRoute } from "next"

const isProduction = process.env.NODE_ENV === "production"

export default function robots(): MetadataRoute.Robots {
  const host = new URL(env.NEXT_PUBLIC_SITE_URL).origin

  return {
    rules: isProduction
      ? [
          {
            userAgent: "*",
            allow: "/",
          },
        ]
      : [
          {
            userAgent: "*",
            disallow: "/",
          },
        ],
    sitemap: `${host}/sitemap.xml`,
    host,
  }
}
