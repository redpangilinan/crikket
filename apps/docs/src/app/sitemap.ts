import { env } from "@crikket/env/web"
import type { MetadataRoute } from "next"

import { source } from "@/lib/source"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes = new Set(["/", "/docs"])

  for (const page of source.getPages()) {
    routes.add(page.url)
  }

  return [...routes].map((route) => ({
    url: new URL(route, env.NEXT_PUBLIC_SITE_URL).toString(),
    lastModified: now,
  }))
}
