import type { polarClient } from "../../lib/payments"
import {
  ACTIVE_PAID_SUBSCRIPTION_STATUSES,
  BILLING_SUBSCRIPTION_STATUS,
  normalizeBillingSubscriptionStatus,
} from "../../model"
import { extractReferenceIdFromMetadata } from "../polar-payload"

export type BillingInterval = "monthly" | "yearly"

export type OrganizationBillingAccountSnapshot = {
  polarCustomerId: string | null
  polarSubscriptionId: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean | null
}

export type PolarSubscription = Awaited<
  ReturnType<typeof polarClient.subscriptions.get>
>

export type PolarCustomer = Awaited<
  ReturnType<typeof polarClient.customers.getExternal>
>

export type BillingUserProfile = {
  email: string
  name: string
}

export type ActiveSubscriptionListFilter =
  | { customerId: string }
  | { externalCustomerId: string }
  | { metadata: { referenceId: string } }

export type PortalResolutionState = {
  customerId: string | null
  subscriptionId: string | null
  recoveryFailures: string[]
}

export const EMPTY_BILLING_ACCOUNT_SNAPSHOT: OrganizationBillingAccountSnapshot =
  {
    polarCustomerId: null,
    polarSubscriptionId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: null,
  }

export function isActivePaidSubscriptionStatus(status: unknown): boolean {
  return ACTIVE_PAID_SUBSCRIPTION_STATUSES.has(
    normalizeBillingSubscriptionStatus(status)
  )
}

const UPDATABLE_SUBSCRIPTION_STATUSES = new Set([
  BILLING_SUBSCRIPTION_STATUS.active,
  BILLING_SUBSCRIPTION_STATUS.trialing,
  BILLING_SUBSCRIPTION_STATUS.pastDue,
  BILLING_SUBSCRIPTION_STATUS.unpaid,
  BILLING_SUBSCRIPTION_STATUS.incomplete,
])

export function isUpdatableSubscriptionStatus(status: unknown): boolean {
  return UPDATABLE_SUBSCRIPTION_STATUSES.has(
    normalizeBillingSubscriptionStatus(status)
  )
}

export function isSubscriptionBoundToOrganization(
  subscription: {
    metadata: unknown
    customer: { externalId: string | null }
  },
  organizationId: string
): boolean {
  const referenceId = extractReferenceIdFromMetadata(subscription.metadata)
  if (referenceId === organizationId) {
    return true
  }

  return subscription.customer.externalId === organizationId
}
