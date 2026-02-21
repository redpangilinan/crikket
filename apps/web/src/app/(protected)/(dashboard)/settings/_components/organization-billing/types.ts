export type BillingPlan = "free" | "pro" | "studio"
export type SwitchablePlan = "pro" | "studio"
export type BillingInterval = "monthly" | "yearly"

export type BillingPlanLimits = Record<
  BillingPlan,
  {
    monthlyPriceUsd: number
    yearlyPriceUsd: number
    canUploadVideo: boolean
    maxVideoDurationMs: number | null
    memberCap: number | null
  }
>

export interface OrganizationBillingCardProps {
  billing: {
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | Date | null
    currentPeriodStart: string | Date | null
    limits: BillingPlanLimits | null
    memberCap: number | null
    memberCount: number
    plan: BillingPlan
    subscriptionStatus: string
  }
  canManageBilling: boolean
  organizationId: string
}

export interface PlanOption {
  slug: SwitchablePlan
  description: string
  prices: {
    monthlyPriceUsd: number
    yearlyPriceUsd: number
  }
}

export interface BillingSummarySnapshot {
  cancelAtPeriodEnd: boolean
  currentBillingInterval: BillingInterval | null
  currentPeriodEnd: string | Date | null
  memberCap: number | null
  memberCount: number
  plan: BillingPlan
  proMemberCap: number
  subscriptionStatus: string
}

export interface BillingSummaryPricing {
  currentPlanMonthlyPrice: number
  currentPlanYearlyPrice: number
}

export interface PlanOptionCardContext {
  billingInterval: BillingInterval
  canManageBilling: boolean
  currentBillingInterval: BillingInterval | null
  currentPlan: BillingPlan
  isPlanSelectionLocked: boolean
  isMutating: boolean
}
