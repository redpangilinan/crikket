import {
  billingPlanMonthlyBasePriceUsd,
  billingPlanYearlyBasePriceUsd,
} from "@crikket/shared/constants/billing"

export const BILLING_PLAN = {
  free: "free",
  pro: "pro",
  studio: "studio",
} as const

export type BillingPlan = (typeof BILLING_PLAN)[keyof typeof BILLING_PLAN]

export type BillingPlanEntitlementConfig = {
  canCreateBugReports: boolean
  canUploadVideo: boolean
  maxVideoDurationMs: number | null
  memberCap: number | null
}

export const BILLING_SUBSCRIPTION_STATUS = {
  active: "active",
  canceled: "canceled",
  incomplete: "incomplete",
  none: "none",
  pastDue: "past_due",
  trialing: "trialing",
  unpaid: "unpaid",
} as const

export type BillingSubscriptionStatus =
  (typeof BILLING_SUBSCRIPTION_STATUS)[keyof typeof BILLING_SUBSCRIPTION_STATUS]

export const ACTIVE_PAID_SUBSCRIPTION_STATUSES =
  new Set<BillingSubscriptionStatus>([
    BILLING_SUBSCRIPTION_STATUS.active,
    BILLING_SUBSCRIPTION_STATUS.trialing,
  ])

export type EntitlementSnapshot = {
  plan: BillingPlan
  canCreateBugReports: boolean
  canUploadVideo: boolean
  maxVideoDurationMs: number | null
  memberCap: number | null
}

export type EntitlementMetadata = Record<string, unknown>

export type BillingPlanLimitSnapshot = EntitlementSnapshot & {
  monthlyPriceUsd: number
  yearlyPriceUsd: number
}

export const billingPlanEntitlementsConfig: Record<
  BillingPlan,
  BillingPlanEntitlementConfig
> = {
  free: {
    canCreateBugReports: false,
    canUploadVideo: false,
    maxVideoDurationMs: 0,
    memberCap: 1,
  },
  pro: {
    canCreateBugReports: true,
    canUploadVideo: true,
    maxVideoDurationMs: 600_000,
    memberCap: 15,
  },
  studio: {
    canCreateBugReports: true,
    canUploadVideo: true,
    maxVideoDurationMs: 1_200_000,
    memberCap: null,
  },
}

const BILLING_PLANS = [
  BILLING_PLAN.free,
  BILLING_PLAN.pro,
  BILLING_PLAN.studio,
] as const satisfies readonly BillingPlan[]

const disabledEntitlementOverrides = {
  canCreateBugReports: true,
  canUploadVideo: true,
  maxVideoDurationMs: null,
  memberCap: null,
} as const

function createPlanEntitlements(plan: BillingPlan): EntitlementSnapshot {
  return {
    plan,
    ...billingPlanEntitlementsConfig[plan],
  }
}

export function getBillingDisabledEntitlements(
  plan: BillingPlan = BILLING_PLAN.studio
): EntitlementSnapshot {
  return {
    plan,
    ...disabledEntitlementOverrides,
  }
}

export const billingPlanConfig: Record<BillingPlan, EntitlementSnapshot> =
  Object.fromEntries(
    BILLING_PLANS.map((plan) => [plan, createPlanEntitlements(plan)])
  ) as Record<BillingPlan, EntitlementSnapshot>

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function readBoolean(value: unknown, fallbackValue: boolean): boolean {
  return typeof value === "boolean" ? value : fallbackValue
}

function readNullableNumber(
  value: unknown,
  fallbackValue: number | null
): number | null {
  if (value === null) {
    return null
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  return fallbackValue
}

export function serializeEntitlements(
  snapshot: EntitlementSnapshot
): EntitlementMetadata {
  return {
    canCreateBugReports: snapshot.canCreateBugReports,
    canUploadVideo: snapshot.canUploadVideo,
    maxVideoDurationMs: snapshot.maxVideoDurationMs,
    memberCap: snapshot.memberCap,
  }
}

export function deserializeEntitlements(
  plan: BillingPlan,
  metadata: unknown
): EntitlementSnapshot {
  const metadataRecord = asRecord(metadata)
  const baseline = billingPlanConfig[plan]

  return {
    plan,
    canCreateBugReports: readBoolean(
      metadataRecord?.canCreateBugReports,
      baseline.canCreateBugReports
    ),
    canUploadVideo: readBoolean(
      metadataRecord?.canUploadVideo,
      baseline.canUploadVideo
    ),
    maxVideoDurationMs: readNullableNumber(
      metadataRecord?.maxVideoDurationMs,
      baseline.maxVideoDurationMs
    ),
    memberCap: readNullableNumber(
      metadataRecord?.memberCap,
      baseline.memberCap
    ),
  }
}

export const billingPlanMonthlyPriceUsd: Record<BillingPlan, number> = {
  ...billingPlanMonthlyBasePriceUsd,
}

export const billingPlanYearlyPriceUsd: Record<BillingPlan, number> = {
  ...billingPlanYearlyBasePriceUsd,
}

function createPlanLimitSnapshot(
  entitlements: EntitlementSnapshot,
  monthlyPriceUsd: number,
  yearlyPriceUsd: number
): BillingPlanLimitSnapshot {
  return {
    ...entitlements,
    monthlyPriceUsd,
    yearlyPriceUsd,
  }
}

export function getBillingPlanLimitsSnapshot(): Record<
  BillingPlan,
  BillingPlanLimitSnapshot
> {
  return Object.fromEntries(
    BILLING_PLANS.map((plan) => [
      plan,
      createPlanLimitSnapshot(
        billingPlanConfig[plan],
        billingPlanMonthlyPriceUsd[plan],
        billingPlanYearlyPriceUsd[plan]
      ),
    ])
  ) as Record<BillingPlan, BillingPlanLimitSnapshot>
}

export function getBillingDisabledPlanLimitsSnapshot(): Record<
  BillingPlan,
  BillingPlanLimitSnapshot
> {
  return Object.fromEntries(
    BILLING_PLANS.map((plan) => [
      plan,
      createPlanLimitSnapshot(getBillingDisabledEntitlements(plan), 0, 0),
    ])
  ) as Record<BillingPlan, BillingPlanLimitSnapshot>
}

export function normalizeBillingPlan(value: unknown): BillingPlan {
  if (value === BILLING_PLAN.pro) {
    return BILLING_PLAN.pro
  }

  if (value === BILLING_PLAN.studio) {
    return BILLING_PLAN.studio
  }

  return BILLING_PLAN.free
}

export function normalizeBillingSubscriptionStatus(
  value: unknown
): BillingSubscriptionStatus {
  if (value === BILLING_SUBSCRIPTION_STATUS.active) {
    return BILLING_SUBSCRIPTION_STATUS.active
  }

  if (value === BILLING_SUBSCRIPTION_STATUS.trialing) {
    return BILLING_SUBSCRIPTION_STATUS.trialing
  }

  if (value === BILLING_SUBSCRIPTION_STATUS.pastDue) {
    return BILLING_SUBSCRIPTION_STATUS.pastDue
  }

  if (value === BILLING_SUBSCRIPTION_STATUS.canceled) {
    return BILLING_SUBSCRIPTION_STATUS.canceled
  }

  if (value === BILLING_SUBSCRIPTION_STATUS.unpaid) {
    return BILLING_SUBSCRIPTION_STATUS.unpaid
  }

  if (value === BILLING_SUBSCRIPTION_STATUS.incomplete) {
    return BILLING_SUBSCRIPTION_STATUS.incomplete
  }

  return BILLING_SUBSCRIPTION_STATUS.none
}

export function resolveEntitlements(input: {
  plan: BillingPlan
  subscriptionStatus: BillingSubscriptionStatus
}): EntitlementSnapshot {
  const planConfig = billingPlanConfig[input.plan]
  const isPaidPlan =
    input.plan === BILLING_PLAN.pro || input.plan === BILLING_PLAN.studio
  const isSubscriptionActive = ACTIVE_PAID_SUBSCRIPTION_STATUSES.has(
    input.subscriptionStatus
  )

  if (isPaidPlan && !isSubscriptionActive) {
    return billingPlanConfig[BILLING_PLAN.free]
  }

  return planConfig
}
