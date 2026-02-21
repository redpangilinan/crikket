import { authClient } from "@crikket/auth/client"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getProtectedAuthData } from "@/app/(protected)/_lib/get-protected-auth-data"
import { client } from "@/utils/orpc"

import { OrganizationBillingCard } from "../_components/organization-billing-card"
import { getRequestErrorMessage } from "../_lib/get-request-error-message"

export const metadata: Metadata = {
  title: "Billing Settings",
  description: "Manage your organization plan, pricing, and billing portal.",
}

type BillingSnapshot = Awaited<
  ReturnType<typeof client.billing.getCurrentOrganizationPlan>
>
type BillingPlanLimitsSnapshot = Awaited<
  ReturnType<typeof client.billing.getPlanLimits>
>

export default async function BillingSettingsPage() {
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

  const billingPromise: Promise<{
    data: BillingSnapshot | null
    error: unknown
  }> = client.billing
    .getCurrentOrganizationPlan({
      organizationId: activeOrganization.id,
    })
    .then((data) => ({
      data,
      error: null,
    }))
    .catch((error) => ({
      data: null,
      error,
    }))

  const planLimitsPromise: Promise<{
    data: BillingPlanLimitsSnapshot | null
    error: unknown
  }> = client.billing
    .getPlanLimits()
    .then((data) => ({
      data,
      error: null,
    }))
    .catch((error) => ({
      data: null,
      error,
    }))

  const [{ data: memberRoleData }, billingState, planLimitsState] =
    await Promise.all([
      authClient.organization.getActiveMemberRole({
        query: {
          organizationId: activeOrganization.id,
        },
        ...authFetchOptions,
      }),
      billingPromise,
      planLimitsPromise,
    ])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-xl tracking-tight">Billing</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage plan and payments for {activeOrganization.name}.
        </p>
      </div>

      <OrganizationBillingCard
        billing={{
          cancelAtPeriodEnd: billingState.data?.cancelAtPeriodEnd ?? false,
          currentPeriodEnd: billingState.data?.currentPeriodEnd ?? null,
          currentPeriodStart: billingState.data?.currentPeriodStart ?? null,
          limits: planLimitsState.data,
          memberCap: billingState.data?.entitlements.memberCap ?? null,
          memberCount: billingState.data?.memberCount ?? 0,
          plan: billingState.data?.plan ?? "free",
          subscriptionStatus: billingState.data?.subscriptionStatus ?? "none",
        }}
        canManageBilling={(memberRoleData?.role ?? "member") === "owner"}
        organizationId={activeOrganization.id}
      />

      {billingState.error ? (
        <p className="text-destructive text-sm">
          Failed to load billing: {getRequestErrorMessage(billingState.error)}
        </p>
      ) : null}
      {planLimitsState.error ? (
        <p className="text-destructive text-sm">
          Failed to load plan limits:{" "}
          {getRequestErrorMessage(planLimitsState.error)}
        </p>
      ) : null}
    </div>
  )
}
