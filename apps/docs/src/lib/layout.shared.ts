import { siteConfig } from "@crikket/shared/config/site"
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: siteConfig.links.repo,
    nav: {
      title: siteConfig.name,
      transparentMode: "top",
    },
  }
}
