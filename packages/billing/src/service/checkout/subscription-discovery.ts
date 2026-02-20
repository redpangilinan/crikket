import { polarClient } from "../../lib/payments"
import { BILLING_SUBSCRIPTION_STATUS } from "../../model"
import { collectPaginatedPolarItems } from "../polar-pagination"
import { isPolarResourceNotFoundError } from "../utils"
import {
  type ActiveSubscriptionListFilter,
  EMPTY_BILLING_ACCOUNT_SNAPSHOT,
  isSubscriptionBoundToOrganization,
  isUpdatableSubscriptionStatus,
  type OrganizationBillingAccountSnapshot,
  type PolarSubscription,
} from "./types"

function resolveSubscriptionStatusPriority(status: unknown): number {
  if (
    status === BILLING_SUBSCRIPTION_STATUS.active ||
    status === BILLING_SUBSCRIPTION_STATUS.trialing
  ) {
    return 3
  }

  if (status === BILLING_SUBSCRIPTION_STATUS.pastDue) {
    return 2
  }

  if (status === BILLING_SUBSCRIPTION_STATUS.unpaid) {
    return 1
  }

  if (status === BILLING_SUBSCRIPTION_STATUS.incomplete) {
    return 0
  }

  return -1
}

function resolveSubscriptionRecencyScore(
  subscription: PolarSubscription
): number {
  const periodEnd = subscription.currentPeriodEnd?.getTime() ?? 0
  if (periodEnd > 0) {
    return periodEnd
  }

  const periodStart = subscription.currentPeriodStart?.getTime() ?? 0
  if (periodStart > 0) {
    return periodStart
  }

  return 0
}

function selectBestUpdatableSubscription(
  subscriptions: PolarSubscription[]
): PolarSubscription | null {
  if (subscriptions.length === 0) {
    return null
  }

  return subscriptions.reduce((best, candidate) => {
    const bestPriority = resolveSubscriptionStatusPriority(best.status)
    const candidatePriority = resolveSubscriptionStatusPriority(
      candidate.status
    )
    if (candidatePriority > bestPriority) {
      return candidate
    }
    if (candidatePriority < bestPriority) {
      return best
    }

    return resolveSubscriptionRecencyScore(candidate) >
      resolveSubscriptionRecencyScore(best)
      ? candidate
      : best
  })
}

async function findCandidateSubscriptionById(input: {
  billingAccount: OrganizationBillingAccountSnapshot
  organizationId: string
}): Promise<PolarSubscription | null> {
  const { billingAccount, organizationId } = input
  const candidateSubscriptionId = billingAccount.polarSubscriptionId
  if (!candidateSubscriptionId) {
    return null
  }

  try {
    const subscription = await polarClient.subscriptions.get({
      id: candidateSubscriptionId,
    })
    if (!isUpdatableSubscriptionStatus(subscription.status)) {
      return null
    }

    if (isSubscriptionBoundToOrganization(subscription, organizationId)) {
      return subscription
    }

    return null
  } catch (error) {
    if (!isPolarResourceNotFoundError(error)) {
      throw error
    }

    return null
  }
}

async function listUpdatableSubscriptionsByFilters(
  listFilters: ActiveSubscriptionListFilter[]
): Promise<PolarSubscription[]> {
  const updatableSubscriptions: PolarSubscription[] = []
  const seenSubscriptionIds = new Set<string>()

  for (const listFilter of listFilters) {
    const subscriptions = await collectPaginatedPolarItems({
      fetchPage: (page, limit) =>
        polarClient.subscriptions.list({
          ...listFilter,
          limit,
          page,
        }),
    })

    for (const subscription of subscriptions) {
      if (!isUpdatableSubscriptionStatus(subscription.status)) {
        continue
      }

      if (seenSubscriptionIds.has(subscription.id)) {
        continue
      }

      seenSubscriptionIds.add(subscription.id)
      updatableSubscriptions.push(subscription)
    }
  }

  return updatableSubscriptions
}

async function findOrganizationSubscriptionByMetadata(
  organizationId: string
): Promise<PolarSubscription | null> {
  const subscriptions = await listUpdatableSubscriptionsByFilters([
    { metadata: { referenceId: organizationId } },
  ])

  return selectBestUpdatableSubscription(subscriptions)
}

export async function findUpdatableSubscription(input: {
  organizationId: string
  billingAccount?: OrganizationBillingAccountSnapshot | null
}): Promise<PolarSubscription | null> {
  const organizationBillingAccountSnapshot =
    input.billingAccount ?? EMPTY_BILLING_ACCOUNT_SNAPSHOT

  const candidateSubscription = await findCandidateSubscriptionById({
    billingAccount: organizationBillingAccountSnapshot,
    organizationId: input.organizationId,
  })
  if (candidateSubscription) {
    return candidateSubscription
  }

  const metadataMatchedSubscription =
    await findOrganizationSubscriptionByMetadata(input.organizationId)
  if (metadataMatchedSubscription) {
    return metadataMatchedSubscription
  }

  const listFilters: ActiveSubscriptionListFilter[] = []
  if (organizationBillingAccountSnapshot.polarCustomerId) {
    listFilters.push({
      customerId: organizationBillingAccountSnapshot.polarCustomerId,
    })
  }
  listFilters.push({ externalCustomerId: input.organizationId })

  const updatableSubscriptions =
    await listUpdatableSubscriptionsByFilters(listFilters)

  const organizationMatchedSubscriptions = updatableSubscriptions.filter(
    (subscription) =>
      isSubscriptionBoundToOrganization(subscription, input.organizationId)
  )

  return selectBestUpdatableSubscription(organizationMatchedSubscriptions)
}
