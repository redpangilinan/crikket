"use client"

import { ConfirmationDialog } from "@crikket/ui/components/dialogs/confirmation-dialog"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import * as React from "react"

import { BillingSummary } from "./organization-billing/billing-summary"
import { PlanChangeConfirmationDialog } from "./organization-billing/plan-change-confirmation-dialog"
import { PlanOptionCard } from "./organization-billing/plan-option-card"
import type {
  BillingInterval,
  BillingSummaryPricing,
  BillingSummarySnapshot,
  OrganizationBillingCardProps,
  PlanOptionCardContext,
} from "./organization-billing/types"
import { useBillingActions } from "./organization-billing/use-billing-actions"
import {
  formatDateLabel,
  getPendingPlanPrice,
  getPlanOptions,
  getPlanPrice,
  inferCurrentBillingInterval,
} from "./organization-billing/utils"

function BillingManagementActions(props: {
  canManageBilling: boolean
  isBillingEnabled: boolean
  canCancelSubscription: boolean
  canUncancelSubscription: boolean
  canOpenPortal: boolean
  isMutating: boolean
  onCancelSubscription: () => void
  onUncancelSubscription: () => void
  onOpenPortal: () => void
}) {
  if (!(props.canManageBilling && props.isBillingEnabled)) {
    return (
      <p className="text-muted-foreground text-sm">
        {props.isBillingEnabled
          ? "Only organization owners can manage billing."
          : "Payments are disabled in this deployment."}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {props.canOpenPortal ? (
        <Button
          disabled={props.isMutating}
          onClick={props.onOpenPortal}
          variant="outline"
        >
          Open Billing Portal
        </Button>
      ) : null}
      {props.canCancelSubscription ? (
        <Button
          disabled={props.isMutating}
          onClick={props.onCancelSubscription}
          variant="destructive"
        >
          Cancel Subscription
        </Button>
      ) : null}
      {props.canUncancelSubscription ? (
        <Button
          disabled={props.isMutating}
          onClick={props.onUncancelSubscription}
          variant="default"
        >
          Resume Subscription
        </Button>
      ) : null}
    </div>
  )
}

export function OrganizationBillingCard({
  billing,
  organizationId,
  canManageBilling,
}: OrganizationBillingCardProps) {
  const {
    cancelAtPeriodEnd,
    currentPeriodEnd,
    currentPeriodStart,
    limits,
    memberCap,
    memberCount,
    plan,
    subscriptionStatus,
  } = billing
  const [billingInterval, setBillingInterval] =
    React.useState<BillingInterval>("monthly")

  const {
    currentPlanLimit,
    currentPlanMonthlyPrice,
    currentPlanYearlyPrice,
    proMemberCap,
    proPrice,
    proYearlyPrice,
    studioPrice,
    studioYearlyPrice,
  } = getPlanPrice({
    limits,
    plan,
  })

  const isBillingEnabled = proPrice > 0 || studioPrice > 0
  const planOptions = getPlanOptions({
    proPrice,
    proYearlyPrice,
    studioPrice,
    studioYearlyPrice,
  })

  const actions = useBillingActions({
    billingInterval,
    organizationId,
  })

  const currentBillingInterval = inferCurrentBillingInterval({
    currentPeriodStart,
    currentPeriodEnd,
  })

  const pendingPlanPrice = getPendingPlanPrice({
    pendingPlan: actions.pendingPlan,
    billingInterval,
    proPrice,
    proYearlyPrice,
    studioPrice,
    studioYearlyPrice,
  })
  const cancellationDateLabel = formatDateLabel(currentPeriodEnd)

  const hasManageablePaidSubscription =
    subscriptionStatus !== "none" && subscriptionStatus !== "canceled"
  const canOpenPortal = plan !== "free" && canManageBilling && isBillingEnabled
  const isPlanSelectionLocked =
    cancelAtPeriodEnd && hasManageablePaidSubscription
  const canCancelSubscription =
    canOpenPortal && !cancelAtPeriodEnd && hasManageablePaidSubscription
  const canUncancelSubscription =
    canOpenPortal && cancelAtPeriodEnd && hasManageablePaidSubscription
  const planOptionContext: PlanOptionCardContext = {
    billingInterval,
    canManageBilling,
    currentBillingInterval,
    currentPlan: plan,
    isPlanSelectionLocked,
    isMutating: actions.isMutating,
  }
  const billingSummarySnapshot: BillingSummarySnapshot = {
    cancelAtPeriodEnd,
    currentBillingInterval,
    currentPeriodEnd,
    memberCap,
    memberCount,
    plan,
    proMemberCap,
    subscriptionStatus,
  }
  const billingSummaryPricing: BillingSummaryPricing = {
    currentPlanMonthlyPrice,
    currentPlanYearlyPrice,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Billing</CardTitle>
        <CardDescription>
          {isBillingEnabled
            ? "Billing is scoped to the active workspace."
            : "Billing is disabled for this deployment. All features are unlocked."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <BillingSummary
          currentPlanLimit={currentPlanLimit}
          pricing={billingSummaryPricing}
          snapshot={billingSummarySnapshot}
        />

        {isBillingEnabled ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium text-sm">Available plans</h3>
              <div className="inline-flex rounded-lg border p-1">
                <Button
                  className="h-8 px-3 text-xs"
                  onClick={() => setBillingInterval("monthly")}
                  size="sm"
                  type="button"
                  variant={billingInterval === "monthly" ? "default" : "ghost"}
                >
                  Monthly
                </Button>
                <Button
                  className="h-8 px-3 text-xs"
                  onClick={() => setBillingInterval("yearly")}
                  size="sm"
                  type="button"
                  variant={billingInterval === "yearly" ? "default" : "ghost"}
                >
                  Yearly
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {planOptions.map((option) => (
                <PlanOptionCard
                  context={planOptionContext}
                  key={option.slug}
                  onSelect={actions.handlePlanSelection}
                  option={option}
                />
              ))}
            </div>
            {isPlanSelectionLocked ? (
              <p className="text-amber-700 text-sm">
                This subscription is set to cancel at period end. Resume it
                first before switching plans.
              </p>
            ) : null}
          </div>
        ) : null}

        <BillingManagementActions
          canCancelSubscription={canCancelSubscription}
          canManageBilling={canManageBilling}
          canOpenPortal={canOpenPortal}
          canUncancelSubscription={canUncancelSubscription}
          isBillingEnabled={isBillingEnabled}
          isMutating={actions.isMutating}
          onCancelSubscription={actions.requestCancelSubscription}
          onOpenPortal={actions.openPortal}
          onUncancelSubscription={actions.requestUncancelSubscription}
        />
      </CardContent>

      <PlanChangeConfirmationDialog
        billingInterval={billingInterval}
        isLoading={actions.isPlanChangePending}
        onConfirm={actions.handleConfirmPlanChange}
        onOpenChange={actions.handlePlanDialogOpenChange}
        open={actions.isPlanConfirmOpen}
        pendingPlan={actions.pendingPlan}
        pendingPlanPrice={pendingPlanPrice}
      />

      <ConfirmationDialog
        cancelText="Keep subscription"
        confirmText="Cancel at period end"
        description={
          cancellationDateLabel
            ? `Your subscription stays active until ${cancellationDateLabel}, then it will be canceled.`
            : "Your subscription will stay active until the end of the current billing period, then it will be canceled."
        }
        isLoading={actions.isCancelPending}
        onConfirm={actions.handleConfirmCancellation}
        onOpenChange={actions.handleCancelDialogOpenChange}
        open={actions.isCancelConfirmOpen}
        title="Cancel subscription?"
        variant="destructive"
      />

      <ConfirmationDialog
        cancelText="Keep cancellation"
        confirmText="Resume subscription"
        description="This removes the pending cancellation so billing continues on the current cycle."
        isLoading={actions.isUncancelPending}
        onConfirm={actions.handleConfirmUncancel}
        onOpenChange={actions.handleUncancelDialogOpenChange}
        open={actions.isUncancelConfirmOpen}
        title="Resume subscription?"
      />
    </Card>
  )
}
