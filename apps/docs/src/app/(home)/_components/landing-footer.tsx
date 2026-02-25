import { env } from "@crikket/env/web"
import { siteConfig } from "@crikket/shared/config/site"
import Link from "next/link"

type FooterLink = {
  label: string
  href: string
  external?: boolean
}

export function LandingFooter() {
  const year = new Date().getFullYear()

  const productLinks: FooterLink[] = [
    { label: "Web App", href: env.NEXT_PUBLIC_APP_URL, external: true },
    {
      label: "Billing",
      href: `${env.NEXT_PUBLIC_APP_URL}/settings/billing`,
      external: true,
    },
  ]

  if (env.NEXT_PUBLIC_DEMO_URL) {
    productLinks.push({
      label: "Live Demo",
      href: env.NEXT_PUBLIC_DEMO_URL,
      external: true,
    })
  }

  const resourceLinks: FooterLink[] = [
    { label: "Documentation", href: "/docs" },
  ]
  const communityLinks: FooterLink[] = [
    { label: "GitHub", href: siteConfig.links.repo, external: true },
    { label: "X (Twitter)", href: siteConfig.links.twitter, external: true },
  ]

  return (
    <footer className="z-10 mt-24 w-full border-border/60 border-t bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-12 px-4 py-12 sm:px-8 xl:px-12">
        <div className="grid grid-cols-1 gap-10 text-left sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="font-semibold text-base">{siteConfig.name}</p>
            <p className="max-w-xs text-muted-foreground text-sm">
              {siteConfig.description}
            </p>
          </div>

          <FooterColumn links={productLinks} title="Product" />
          <FooterColumn links={resourceLinks} title="Resources" />
          <FooterColumn links={communityLinks} title="Community" />
        </div>

        <div className="flex flex-col gap-3 border-border/60 border-t pt-6 text-muted-foreground text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {siteConfig.name}. All rights reserved.
          </p>
          <p>
            Built by{" "}
            <Link
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              href={siteConfig.links.github}
              rel="noreferrer"
              target="_blank"
            >
              redpangilinan
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: FooterLink[]
}) {
  return (
    <div className="space-y-3">
      <p className="font-medium text-sm">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
              href={link.href}
              rel={link.external ? "noreferrer" : undefined}
              target={link.external ? "_blank" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
