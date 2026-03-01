"use client"

import type { authClient } from "@crikket/auth/client"
import {
  Collapsible,
  CollapsibleContent,
} from "@crikket/ui/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@crikket/ui/components/ui/sidebar"
import { BookOpen, ChevronRight, Settings2, Video } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type * as React from "react"
import { useState } from "react"
import { TeamSwitcher } from "@/components/team-switcher"
import { UserNav } from "@/components/user-nav"
import { getDocsUrl } from "@/lib/site"

type Organization = typeof authClient.$Infer.Organization

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: typeof authClient.$Infer.Session.user
  organizations: Organization[]
  activeOrganization?: Organization
}

const navMain = [
  {
    title: "Bug Reports",
    url: "/" as const,
    matchPrefix: "/" as const,
    icon: Video,
  },
  {
    title: "Settings",
    matchPrefix: "/settings" as const,
    icon: Settings2,
    items: [
      {
        title: "User",
        url: "/settings/user" as const,
      },
      {
        title: "Organization",
        url: "/settings/organization" as const,
      },
      {
        title: "Public Keys",
        url: "/settings/keys" as const,
      },
      {
        title: "Billing",
        url: "/settings/billing" as const,
      },
    ],
  },
] as const

const navSecondary = [
  {
    title: "Documentation",
    url: "/docs",
    icon: BookOpen,
  },
] as const

export function AppSidebar({
  user,
  organizations,
  activeOrganization,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const docsUrl = getDocsUrl()
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({})

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          activeOrganization={activeOrganization}
          organizations={organizations}
          userId={user.id}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => {
                const isActive =
                  item.matchPrefix === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.matchPrefix)
                const hasSubItems = "items" in item && item.items.length > 0
                const isSectionOpen = hasSubItems
                  ? (expandedSections[item.title] ?? isActive)
                  : false

                return (
                  <Collapsible key={item.title} open={isSectionOpen}>
                    <SidebarMenuItem>
                      {hasSubItems ? (
                        <SidebarMenuButton
                          aria-label={`Toggle ${item.title} section`}
                          onClick={(event) => {
                            event.preventDefault()
                            setExpandedSections((prev) => ({
                              ...prev,
                              [item.title]: !isSectionOpen,
                            }))
                          }}
                          type="button"
                        >
                          <item.icon />
                          <span>{item.title}</span>
                          <ChevronRight
                            className={`ml-auto size-4 transition-transform ${isSectionOpen ? "rotate-90" : ""}`}
                          />
                        </SidebarMenuButton>
                      ) : "url" in item ? (
                        <SidebarMenuButton
                          isActive={isActive}
                          render={(props) => (
                            <Link href={item.url as Route} {...props} />
                          )}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      ) : null}
                      {hasSubItems ? (
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.url}>
                                <SidebarMenuSubButton
                                  isActive={pathname.startsWith(subItem.url)}
                                  render={(props) => (
                                    <Link
                                      href={subItem.url as Route}
                                      {...props}
                                    />
                                  )}
                                >
                                  <span>{subItem.title}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      ) : null}
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={(props) =>
                      docsUrl ? (
                        <a
                          href={docsUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                          {...props}
                        />
                      ) : (
                        <button type="button" {...props} />
                      )
                    }
                    size="sm"
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserNav user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
