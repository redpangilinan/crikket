"use client"

import type { auth } from "@crikket/auth"
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
  SidebarRail,
} from "@crikket/ui/components/ui/sidebar"
import { BookOpen, Settings2, Video } from "lucide-react"
import Link from "next/link"
import type * as React from "react"
import { TeamSwitcher } from "@/components/team-switcher"
import { UserNav } from "@/components/user-nav"

type Organization = typeof auth.$Infer.Organization

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: typeof auth.$Infer.Session.user
  organizations: Organization[]
  activeOrganization?: Organization
}

const navMain = [
  {
    title: "Bug Reports",
    url: "/" as const,
    icon: Video,
    isActive: true,
  },
  {
    title: "Settings",
    url: "#" as const,
    icon: Settings2,
    isActive: false,
  },
] as const

const navSecondary = [
  {
    title: "Documentation",
    url: "#" as const,
    icon: BookOpen,
  },
] as const

export function AppSidebar({
  user,
  organizations,
  activeOrganization,
  ...props
}: AppSidebarProps) {
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
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={item.isActive}
                    render={(props) => <Link href={item.url} {...props} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={(props) => <Link href={item.url} {...props} />}
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
