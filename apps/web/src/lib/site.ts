import { env } from "@crikket/env/web"

function normalizeUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function getDocsUrl(path = "/docs"): string | null {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    return null
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizeUrl(siteUrl)}${normalizedPath}`
}
