"use client"

import type { auth } from "@crikket/auth"
import { authClient } from "@crikket/auth/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@crikket/ui/components/ui/sidebar"
import { ChevronsUpDown, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

import { CreateOrganizationDialog } from "@/components/create-organization-dialog"

type Organization = typeof auth.$Infer.Organization

interface TeamSwitcherProps {
  organizations: Organization[]
  activeOrganization?: Organization
}

export function TeamSwitcher({
  organizations,
  activeOrganization,
}: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  const handleSwitchOrganization = async (orgId: string) => {
    try {
      await authClient.organization.setActive({
        organizationId: orgId,
      })
      router.refresh()
      toast.success("Organization switched successfully")
    } catch (error) {
      console.error(error)
      toast.error("Failed to switch organization")
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              render={(props) => <div {...props} />}
              size="lg"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {activeOrganization?.logo ? (
                  <img
                    alt={activeOrganization.name}
                    className="size-4"
                    src={activeOrganization.logo}
                  />
                ) : (
                  <span className="font-semibold text-sm uppercase">
                    {activeOrganization?.name.slice(0, 2) ?? "OR"}
                  </span>
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeOrganization?.name ?? "Select Organization"}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {activeOrganization?.slug ?? "No organization"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Organizations
              </DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem
                  className="gap-2 p-2"
                  key={org.id}
                  onClick={() => handleSwitchOrganization(org.id)}
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    {org.logo ? (
                      <img alt={org.name} className="size-4" src={org.logo} />
                    ) : (
                      <span className="font-medium text-xs uppercase">
                        {org.name.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  {org.name}
                  <DropdownMenuShortcut>
                    ⌘{organizations.indexOf(org) + 1}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => setShowCreateDialog(true)}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                Add organization
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateOrganizationDialog
          onOpenChange={setShowCreateDialog}
          open={showCreateDialog}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
