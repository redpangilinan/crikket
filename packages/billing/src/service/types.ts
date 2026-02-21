import type {
  BillingPlan,
  BillingSubscriptionStatus,
  EntitlementSnapshot,
} from "../model"

export type BillingProjectionInput = {
  organizationId: string
  plan?: BillingPlan
  subscriptionStatus?: BillingSubscriptionStatus
  polarCustomerId?: string
  polarSubscriptionId?: string
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
  webhookOccurredAt?: Date
  source?: string
}

export type PolarWebhookPayload = {
  type?: string
  data?: unknown
  [key: string]: unknown
}

export type PolarWebhookProcessingResult = {
  eventType: string
  ignored: boolean
  organizationId?: string
}

export type WebhookBillingBackfill = {
  plan?: BillingPlan
  subscriptionStatus?: BillingSubscriptionStatus
  polarCustomerId?: string
  polarSubscriptionId?: string
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
}

export type ChangeOrganizationPlanResult =
  | {
      action: "updated"
      plan: BillingPlan
    }
  | {
      action: "checkout_required"
      plan: BillingPlan
      url: string
    }
  | {
      action: "unchanged"
      plan: BillingPlan
    }

export type CancelOrganizationSubscriptionResult =
  | {
      action: "scheduled"
      plan: BillingPlan
    }
  | {
      action: "already_scheduled"
      plan: BillingPlan
    }
  | {
      action: "not_found"
      plan: BillingPlan
    }

export type UncancelOrganizationSubscriptionResult =
  | {
      action: "resumed"
      plan: BillingPlan
    }
  | {
      action: "already_active"
      plan: BillingPlan
    }
  | {
      action: "not_found"
      plan: BillingPlan
    }

export type OrganizationBillingSnapshot = {
  organizationId: string
  plan: BillingPlan
  subscriptionStatus: BillingSubscriptionStatus
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  memberCount: number
  entitlements: EntitlementSnapshot
}
