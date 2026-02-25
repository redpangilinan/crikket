import { env } from "@crikket/env/web"
import { siteConfig } from "@crikket/shared/config/site"
import { Button } from "@crikket/ui/components/ui/button"
import { ArrowRight, Github } from "lucide-react"
import Link from "next/link"

export function CtaSection() {
  const appUrl = env.NEXT_PUBLIC_APP_URL
  const docsUrl = "/docs"

  return (
    <section className="w-full scroll-mt-28 px-4 sm:px-0">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-8 text-center shadow-sm backdrop-blur-sm sm:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,198,0.12),transparent_55%)]" />
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="space-y-3">
            <p className="font-medium text-primary text-sm">
              Ready to ship fixes faster?
            </p>
            <h2 className="max-w-2xl text-balance font-bold text-3xl tracking-tight sm:text-4xl">
              Instant bug reports in one click
            </h2>
            <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              Capture issues with steps, logs, and network requests attached,
              then share a single link to your team. Make your developers' lives
              easier.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Link href={appUrl} rel="noopener noreferrer" target="_blank">
              <Button className="h-11 rounded-full px-6">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={docsUrl}>
              <Button className="h-11 rounded-full px-6" variant="secondary">
                Read the Docs
              </Button>
            </Link>
            <Link
              href={siteConfig.links.repo}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button className="h-11 rounded-full px-6" variant="ghost">
                <Github />
                GitHub
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
