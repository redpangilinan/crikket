import { env } from "@crikket/env/web"

export const siteConfig = {
  name: "Crikket",
  title: "Crikket",
  description:
    "Modern instant bug reporting platform. An open-source alternative to jam.dev and marker.io.",
  url: {
    public: env.NEXT_PUBLIC_SITE_URL,
    app: env.NEXT_PUBLIC_APP_URL,
  },
  keywords: [
    "bug reporting",
    "bug tracker",
    "issue reporting",
    "developer tools",
    "open source",
  ],
  seo: {
    titleTemplate: "%s | Crikket",
    canonicalPath: "/",
    locale: "en_US",
    openGraphType: "website" as const,
    twitterCard: "summary_large_image" as const,
    defaultOgImage: "/og.png",
  },
  author: {
    name: "redpangilinan",
    twitter: "@redpngilinan",
  },
  links: {
    repo: "https://github.com/redpangilinan/crikket",
    github: "https://github.com/redpangilinan",
    twitter: "https://x.com/redpngilinan",
  },
}
