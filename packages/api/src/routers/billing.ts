import { cancelSubscription } from "@crikket/billing/procedures/cancel-subscription"
import { changePlan } from "@crikket/billing/procedures/change-plan"
import { getCurrentOrganizationPlan } from "@crikket/billing/procedures/get-current-organization-plan"
import { getEntitlements } from "@crikket/billing/procedures/get-entitlements"
import { getPlanLimits } from "@crikket/billing/procedures/get-plan-limits"
import { openPortal } from "@crikket/billing/procedures/open-portal"
import { recomputeEntitlements } from "@crikket/billing/procedures/recompute-entitlements"
import { uncancelSubscription } from "@crikket/billing/procedures/uncancel-subscription"

export const billingRouter = {
  cancelSubscription,
  changePlan,
  getCurrentOrganizationPlan,
  getEntitlements,
  getPlanLimits,
  openPortal,
  recomputeEntitlements,
  uncancelSubscription,
}
