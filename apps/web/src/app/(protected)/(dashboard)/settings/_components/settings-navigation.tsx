"use client"

import { cn } from "@crikket/ui/lib/utils"
import {
  Building2,
  CreditCard,
  Github,
  KeyRound,
  UserRound,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"

const SETTINGS_ITEMS = [
  {
    href: "/settings/user",
    title: "User",
    description: "Profile and password",
    icon: UserRound,
  },
  {
    href: "/settings/organization",
    title: "Organization",
    description: "Workspace, members, invites",
    icon: Building2,
  },
  {
    href: "/settings/keys",
    title: "Public Keys",
    description: "Widget keys, origins, embeds",
    icon: KeyRound,
  },
  {
    href: "/settings/integrations",
    title: "Integrations",
    description: "Forward reports to external tools",
    icon: Github,
  },
  {
    href: "/settings/billing",
    title: "Billing",
    description: "Plan, pricing, payments",
    icon: CreditCard,
  },
] as const

export function SettingsNavigation() {
  const pathname = usePathname()

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-4">
          <p className="font-semibold text-sm">Settings</p>
          <p className="text-muted-foreground text-xs">
            Choose which area you want to configure.
          </p>
        </div>
        <nav className="grid gap-2 p-2">
          {SETTINGS_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)

            return (
              <Link
                className={cn(
                  "rounded-xl border px-3 py-3 transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/10"
                    : "border-transparent hover:border-border hover:bg-muted/60"
                )}
                href={item.href as Route}
                key={item.href}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 rounded-md p-1.5",
                      isActive ? "bg-primary/15 text-primary" : "bg-muted"
                    )}
                  >
                    <item.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
