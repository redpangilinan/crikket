import { authClient } from "@crikket/auth/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getProtectedAuthData } from "@/app/(protected)/_lib/get-protected-auth-data"
import { client } from "@/utils/orpc"

import { GithubIntegrationForm } from "../_components/github-integration-form"
import { getRequestErrorMessage } from "../_lib/get-request-error-message"

export const metadata: Metadata = {
  title: "Integrations",
  description: "Forward Crikket bug reports to external tools.",
}

export default async function IntegrationsSettingsPage() {
  const { organizations, session } = await getProtectedAuthData()

  if (!session) {
    redirect("/login")
  }

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  const activeOrganization =
    organizations.find(
      (organization) => organization.id === session.session.activeOrganizationId
    ) ?? organizations[0]

  const requestHeaders = await headers()
  const authFetchOptions = {
    fetchOptions: {
      headers: requestHeaders,
    },
  }

  const { data: memberRoleData } =
    await authClient.organization.getActiveMemberRole({
      query: {
        organizationId: activeOrganization.id,
      },
      ...authFetchOptions,
    })

  const canManage =
    memberRoleData?.role === "owner" || memberRoleData?.role === "admin"

  const githubIntegrationState = canManage
    ? await client.githubIntegration
        .get()
        .then((data) => ({ data, error: null as unknown }))
        .catch((error: unknown) => ({
          data: { configured: false as const, repo: null as string | null },
          error,
        }))
    : {
        data: { configured: false as const, repo: null as string | null },
        error: null as unknown,
      }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-xl tracking-tight">Integrations</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Forward new bug reports to external tools for{" "}
          {activeOrganization.name}.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>GitHub Issues</CardTitle>
            <CardDescription>
              Create an issue in your repo whenever a bug report is submitted.
              Screenshots, recordings, and debugger payloads are committed to a
              dedicated <code>crikket-attachments</code> branch and linked from
              the issue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GithubIntegrationForm
              initialConfigured={githubIntegrationState.data.configured}
              initialRepo={githubIntegrationState.data.repo}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>
              Only organization admins and owners can manage integrations.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Ask an organization admin to configure the GitHub integration for
            this workspace.
          </CardContent>
        </Card>
      )}

      {githubIntegrationState.error ? (
        <p className="text-destructive text-sm">
          Failed to load integration:{" "}
          {getRequestErrorMessage(githubIntegrationState.error)}
        </p>
      ) : null}
    </div>
  )
}
