"use client"

import { pricingTiers } from "@crikket/shared/config/pricing"
import { PricingPlans } from "@crikket/ui/components/pricing-plans"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@crikket/ui/components/ui/alert"
import { Button } from "@crikket/ui/components/ui/button"
import { useState } from "react"

import { getDocsUrl } from "@/lib/site"

import { PlanChangeConfirmationDialog } from "../settings/_components/organization-billing/plan-change-confirmation-dialog"
import type {
  BillingInterval,
  SwitchablePlan,
} from "../settings/_components/organization-billing/types"
import { useBillingActions } from "../settings/_components/organization-billing/use-billing-actions"
import { getPendingPlanPrice } from "../settings/_components/organization-billing/utils"

interface DashboardPricingGateProps {
  canManageBilling: boolean
  organizationId: string
  organizationName: string
}

export function DashboardPricingGate({
  canManageBilling,
  organizationId,
  organizationName,
}: DashboardPricingGateProps) {
  const proTier = pricingTiers.find((tier) => tier.slug === "pro")
  const studioTier = pricingTiers.find((tier) => tier.slug === "studio")
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly")
  const actions = useBillingActions({
    billingInterval,
    organizationId,
  })

  if (!(proTier && studioTier)) {
    throw new Error("Pricing tiers are misconfigured.")
  }

  const pendingPlanPrice = getPendingPlanPrice({
    pendingPlan: actions.pendingPlan,
    billingInterval,
    proPrice: proTier.monthlyPrice,
    proYearlyPrice: proTier.yearlyPrice,
    studioPrice: studioTier.monthlyPrice,
    studioYearlyPrice: studioTier.yearlyPrice,
  })
  const selfHostingDocsUrl = getDocsUrl("/docs/self-hosting")

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-8">
        {canManageBilling ? null : (
          <Alert className="mx-auto w-full max-w-3xl">
            <AlertTitle>Owner approval required</AlertTitle>
            <AlertDescription>
              Only organization owners can upgrade {organizationName}. Ask an
              owner to choose Pro or Studio to unlock the dashboard.
            </AlertDescription>
          </Alert>
        )}

        <PricingPlans
          billingInterval={billingInterval}
          caption="Choose a plan to continue."
          className="space-y-8"
          description="Upgrade to access the dashboard."
          onBillingIntervalChange={(nextBillingInterval: BillingInterval) => {
            setBillingInterval(nextBillingInterval)
          }}
          renderAction={(tier) => {
            if (tier.slug === "free") {
              return selfHostingDocsUrl ? (
                <a className="w-full" href={selfHostingDocsUrl}>
                  <Button
                    className="h-12 w-full rounded-xl font-medium text-base"
                    type="button"
                    variant="secondary"
                  >
                    {tier.cta}
                  </Button>
                </a>
              ) : (
                <Button
                  className="h-12 w-full rounded-xl font-medium text-base"
                  disabled
                  type="button"
                  variant="secondary"
                >
                  {tier.cta}
                </Button>
              )
            }

            return (
              <Button
                className="h-12 w-full rounded-xl font-medium text-base"
                disabled={actions.isMutating || !canManageBilling}
                onClick={() =>
                  actions.handlePlanSelection(tier.slug as SwitchablePlan)
                }
                type="button"
                variant={tier.highlighted ? "default" : "secondary"}
              >
                {tier.cta}
              </Button>
            )
          }}
          tiers={pricingTiers}
          title={`Unlock ${organizationName}`}
        />
      </div>

      <PlanChangeConfirmationDialog
        billingInterval={billingInterval}
        isLoading={actions.isPlanChangePending}
        onConfirm={actions.handleConfirmPlanChange}
        onOpenChange={actions.handlePlanDialogOpenChange}
        open={actions.isPlanConfirmOpen}
        pendingPlan={actions.pendingPlan}
        pendingPlanPrice={pendingPlanPrice}
      />
    </>
  )
}
