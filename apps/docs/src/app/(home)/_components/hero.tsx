import { env } from "@crikket/env/web"
import { siteConfig } from "@crikket/shared/config/site"
import { Highlighter } from "@crikket/ui/components/magicui/highlighter"
import { InteractiveHoverButton } from "@crikket/ui/components/magicui/interactive-hover-button"
import { Button } from "@crikket/ui/components/ui/button"
import { Github } from "lucide-react"
import Link from "next/link"
import { HeroDemo } from "./hero-demo"

export function Hero() {
  const appUrl = env.NEXT_PUBLIC_APP_URL
  const demoUrl = env.NEXT_PUBLIC_DEMO_URL

  return (
    <div className="flex w-full flex-col items-center space-y-16">
      <section className="flex max-w-4xl flex-col items-center space-y-8 px-4 sm:px-0">
        <Link
          className="inline-flex cursor-pointer items-center rounded-full border border-border bg-background/50 px-4 py-1.5 font-medium text-muted-foreground text-sm shadow-sm ring-1 ring-border/50 backdrop-blur-sm transition-colors hover:bg-muted/50"
          href={siteConfig.links.repo}
          rel="noreferrer"
          target="_blank"
        >
          <Github />
          Star on GitHub
        </Link>

        <h1 className="text-balance text-center font-extrabold text-5xl tracking-tight sm:text-7xl lg:text-7xl">
          The{" "}
          <Highlighter action="highlight" color="var(--muted-foreground)">
            <span className="text-primary-foreground">open source</span>
          </Highlighter>{" "}
          bug reporting tool
        </h1>

        <p className="max-w-2xl text-balance text-center text-lg text-muted-foreground sm:text-xl">
          Instantly capture everything your team needs to reproduce bugs in one
          click. Stop asking "how did this happen?" and start resolving issues
          faster.
        </p>

        <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row sm:gap-6">
          <Link href={appUrl} rel="noopener noreferrer" target="_blank">
            <InteractiveHoverButton className="h-12 px-8">
              Get Started
            </InteractiveHoverButton>
          </Link>
          {demoUrl ? (
            <Link href={demoUrl} rel="noopener noreferrer" target="_blank">
              <Button className="h-12 rounded-full px-8">Live Demo</Button>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px]">
        <HeroDemo />
      </section>
    </div>
  )
}
