"use client"

import { env } from "@crikket/env/web"
import { siteConfig } from "@crikket/shared/config/site"
import { ModeToggle } from "@crikket/ui/components/mode-toggle"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@crikket/ui/components/ui/sheet"
import { cn } from "@crikket/ui/lib/utils"
import { Github, Menu } from "lucide-react"
import Link from "next/link"
import { type MouseEvent, useEffect, useState } from "react"

const navLinks = [
  {
    title: "Features",
    href: "#features",
  },
  {
    title: "Pricing",
    href: "#pricing",
  },
  {
    title: "FAQ",
    href: "#faq",
  },
  {
    title: "Documentation",
    href: "/docs",
  },
]

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleSectionNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (!href.startsWith("#")) return

    event.preventDefault()

    const targetElement = document.querySelector(href)
    if (!targetElement) return

    const headerOffset = 96
    const top = Math.max(
      targetElement.getBoundingClientRect().top + window.scrollY - headerOffset,
      0
    )

    window.scrollTo({
      top,
      behavior: "smooth",
    })
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex w-full justify-center transition-all duration-300 ease-in-out",
        isScrolled ? "py-4" : "py-4"
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center justify-between transition-all duration-300 ease-in-out",
          isScrolled
            ? "w-[95%] max-w-5xl rounded-2xl border border-border/40 bg-background/95 px-6 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/60"
            : "w-full max-w-6xl bg-transparent px-4"
        )}
      >
        <div className="flex items-center gap-6">
          <Link className="flex items-center space-x-2" href="/">
            <span className="font-bold tracking-tight">{siteConfig.name}</span>
          </Link>
          <nav className="hidden items-center gap-6 font-medium text-sm md:flex">
            {navLinks.map((item) => (
              <Link
                className="text-foreground/60 transition-colors hover:text-foreground/80"
                href={item.href}
                key={item.href}
                onClick={(event) => handleSectionNavigation(event, item.href)}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-2 md:flex">
            <Link
              href={env.NEXT_PUBLIC_APP_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button className="h-9 px-4" size="sm">
                Get Started
              </Button>
            </Link>
            <Link
              href={siteConfig.links.repo}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <Github className="h-4 w-4" />
                <span className="sr-only">GitHub</span>
              </div>
            </Link>
            <ModeToggle />
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <ModeToggle />
            <Sheet onOpenChange={setIsMobileNavOpen} open={isMobileNavOpen}>
              <SheetTrigger
                render={
                  <Button
                    aria-label="Open navigation menu"
                    size="icon-sm"
                    variant="outline"
                  />
                }
              >
                <Menu className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent className="p-0" side="right">
                <div className="flex h-full flex-col">
                  <div className="border-b px-4 py-3">
                    <p className="font-semibold text-sm">Navigation</p>
                  </div>
                  <nav className="flex flex-col gap-1 p-2">
                    {navLinks.map((item) => (
                      <Link
                        className="rounded-md px-3 py-2 font-medium text-sm transition-colors hover:bg-muted"
                        href={item.href}
                        key={item.href}
                        onClick={(event) => {
                          handleSectionNavigation(event, item.href)
                          setIsMobileNavOpen(false)
                        }}
                      >
                        {item.title}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-auto border-t p-3">
                    <Link
                      className="flex items-center gap-2 rounded-md px-3 py-2 font-medium text-sm transition-colors hover:bg-muted"
                      href={siteConfig.links.repo}
                      onClick={() => setIsMobileNavOpen(false)}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <Github className="h-4 w-4" />
                      View on GitHub
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
