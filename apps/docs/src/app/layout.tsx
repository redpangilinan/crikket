import { RootProvider } from "fumadocs-ui/provider/next"

import "@crikket/ui/styles/globals.css"
import { siteConfig } from "@crikket/shared/config/site"
import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url.public),
  title: {
    default: `${siteConfig.name} | The open source bug reporting tool`,
    template: siteConfig.seo.titleTemplate,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.author.name }],
  icons: {
    icon: [{ url: "/favicon/favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/favicon/favicon.svg"],
  },
  alternates: {
    canonical: siteConfig.seo.canonicalPath,
  },
  openGraph: {
    type: "website",
    locale: siteConfig.seo.locale,
    url: siteConfig.seo.canonicalPath,
    title: siteConfig.title,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.seo.defaultOgImage,
        alt: siteConfig.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: siteConfig.author.twitter,
    creator: siteConfig.author.twitter,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [siteConfig.seo.defaultOgImage],
  },
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
