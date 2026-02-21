import { Badge } from "@crikket/ui/components/ui/badge"

import type {
  BillingPlan,
  BillingPlanLimits,
  BillingSummaryPricing,
  BillingSummarySnapshot,
} from "./types"
import {
  formatDateLabel,
  formatMoney,
  formatPlanLabel,
  formatSubscriptionStatus,
  formatVideoDurationLabel,
  planBadgeVariant,
} from "./utils"

interface BillingSummaryProps {
  currentPlanLimit: BillingPlanLimits[BillingPlan] | null
  pricing: BillingSummaryPricing
  snapshot: BillingSummarySnapshot
}

export function BillingSummary(props: BillingSummaryProps) {
  const { currentPlanLimit, pricing, snapshot } = props
  const priceInterval = snapshot.currentBillingInterval ?? "monthly"
  const currentPlanPrice =
    priceInterval === "yearly"
      ? pricing.currentPlanYearlyPrice
      : pricing.currentPlanMonthlyPrice
  const currentPlanPriceLabel =
    snapshot.currentBillingInterval === "yearly"
      ? "Current yearly price"
      : "Current monthly price"
  const memberLimitLabel =
    snapshot.memberCap === null
      ? "Unlimited"
      : `${snapshot.memberCap.toLocaleString()} members`
  const renewalDate = formatDateLabel(snapshot.currentPeriodEnd)
  const exceedsProMemberCap =
    snapshot.plan === "studio" && snapshot.memberCount > snapshot.proMemberCap

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={planBadgeVariant(snapshot.plan)}>
          {formatPlanLabel(snapshot.plan)}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {formatSubscriptionStatus(snapshot.subscriptionStatus)}
        </span>
      </div>

      <p className="mt-3 font-medium text-sm">
        {currentPlanPriceLabel}: {formatMoney(currentPlanPrice, priceInterval)}
      </p>
      <p className="mt-1 text-muted-foreground text-sm">
        {renewalDate
          ? `Next renewal: ${renewalDate}`
          : "No renewal date available yet."}
      </p>
      {snapshot.cancelAtPeriodEnd ? (
        <p className="mt-1 text-amber-700 text-sm">
          {renewalDate
            ? `Cancellation scheduled for ${renewalDate}.`
            : "Cancellation is scheduled for the end of this billing period."}
        </p>
      ) : null}

      <div className="mt-3 space-y-1 text-sm">
        <p>
          Members: {snapshot.memberCount.toLocaleString()} / {memberLimitLabel}
        </p>
        <p>
          Video limit:{" "}
          {currentPlanLimit?.canUploadVideo
            ? formatVideoDurationLabel(currentPlanLimit.maxVideoDurationMs)
            : "Locked"}
        </p>
      </div>

      {exceedsProMemberCap ? (
        <p className="mt-2 text-muted-foreground text-sm">
          Downgrading to Pro keeps current members, but new invites are blocked
          while you are above {snapshot.proMemberCap} members.
        </p>
      ) : null}
    </div>
  )
}
