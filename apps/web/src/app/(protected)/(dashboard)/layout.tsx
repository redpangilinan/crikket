import { authClient } from "@crikket/auth/client"
import { ModeToggle } from "@crikket/ui/components/mode-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@crikket/ui/components/ui/breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@crikket/ui/components/ui/sidebar"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { Shell } from "@/components/shell"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  })

  if (!session) {
    redirect("/login")
  }

  const { data: organizations } = await authClient.organization.list({
    fetchOptions: {
      headers: await headers(),
    },
  })

  const activeOrganization = organizations?.find(
    (org) => org.id === session.session.activeOrganizationId
  )

  return (
    <SidebarProvider className="h-svh items-stretch overflow-hidden">
      <AppSidebar
        activeOrganization={activeOrganization}
        organizations={organizations ?? []}
        user={session.user}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Bug Reports</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>All Bug Reports</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <ModeToggle />
        </header>
        <Shell>{children}</Shell>
      </SidebarInset>
    </SidebarProvider>
  )
}
