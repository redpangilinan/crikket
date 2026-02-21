import { db } from "@crikket/db"
import { organizationBillingAccount } from "@crikket/db/schema/billing"
import { ORPCError } from "@orpc/server"
import { eq } from "drizzle-orm"

import { polarClient } from "../../lib/payments"
import {
  normalizeBillingPlan,
  normalizeBillingSubscriptionStatus,
} from "../../model"
import { assertUserCanManageOrganizationBilling } from "../access"
import { upsertOrganizationBillingProjection } from "../entitlements/projection"
import { resolvePlanFromProductId } from "../polar-payload"
import type {
  CancelOrganizationSubscriptionResult,
  UncancelOrganizationSubscriptionResult,
} from "../types"
import { getErrorMessage } from "../utils"
import { assertPaymentsEnabled } from "./shared"
import { findUpdatableSubscription } from "./subscription-discovery"

const MANUAL_CANCEL_SOURCE = "manual-cancel-subscription"
const MANUAL_UNCANCEL_SOURCE = "manual-uncancel-subscription"

type SubscriptionCancellationMutationResult =
  | CancelOrganizationSubscriptionResult
  | UncancelOrganizationSubscriptionResult

function resolveAlreadyAppliedAction(input: {
  cancelAtPeriodEnd: boolean
  plan: string
}): SubscriptionCancellationMutationResult {
  if (input.cancelAtPeriodEnd) {
    return {
      action: "already_scheduled",
      plan: normalizeBillingPlan(input.plan),
    }
  }

  return {
    action: "already_active",
    plan: normalizeBillingPlan(input.plan),
  }
}

function resolveUpdatedAction(input: {
  cancelAtPeriodEnd: boolean
  plan: string
}): SubscriptionCancellationMutationResult {
  if (input.cancelAtPeriodEnd) {
    return {
      action: "scheduled",
      plan: normalizeBillingPlan(input.plan),
    }
  }

  return {
    action: "resumed",
    plan: normalizeBillingPlan(input.plan),
  }
}

async function setOrganizationSubscriptionCancellation(input: {
  organizationId: string
  userId: string
  cancelAtPeriodEnd: boolean
}): Promise<SubscriptionCancellationMutationResult> {
  const projectionSource = input.cancelAtPeriodEnd
    ? MANUAL_CANCEL_SOURCE
    : MANUAL_UNCANCEL_SOURCE
  const failureMessage = input.cancelAtPeriodEnd
    ? "Failed to cancel subscription"
    : "Failed to resume subscription"

  assertPaymentsEnabled()

  await assertUserCanManageOrganizationBilling({
    organizationId: input.organizationId,
    userId: input.userId,
  })

  const billingAccount = await db.query.organizationBillingAccount.findFirst({
    where: eq(organizationBillingAccount.organizationId, input.organizationId),
    columns: {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      currentPeriodStart: true,
      plan: true,
      polarCustomerId: true,
      polarSubscriptionId: true,
      subscriptionStatus: true,
    },
  })

  const fallbackPlan = normalizeBillingPlan(billingAccount?.plan)

  const updatableSubscription = await findUpdatableSubscription({
    organizationId: input.organizationId,
    billingAccount,
  }).catch((error) => {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: getErrorMessage(
        error,
        "Failed to resolve existing subscription"
      ),
    })
  })

  if (!updatableSubscription) {
    return {
      action: "not_found",
      plan: fallbackPlan,
    }
  }

  const currentPlan =
    resolvePlanFromProductId(updatableSubscription.productId) ?? fallbackPlan
  const currentSubscriptionStatus = normalizeBillingSubscriptionStatus(
    updatableSubscription.status ?? billingAccount?.subscriptionStatus
  )
  const currentCancelAtPeriodEnd =
    updatableSubscription.cancelAtPeriodEnd ??
    billingAccount?.cancelAtPeriodEnd ??
    false

  if (currentCancelAtPeriodEnd === input.cancelAtPeriodEnd) {
    await upsertOrganizationBillingProjection({
      organizationId: input.organizationId,
      plan: currentPlan,
      subscriptionStatus: currentSubscriptionStatus,
      polarCustomerId:
        updatableSubscription.customerId ??
        billingAccount?.polarCustomerId ??
        undefined,
      polarSubscriptionId:
        updatableSubscription.id ??
        billingAccount?.polarSubscriptionId ??
        undefined,
      currentPeriodStart:
        updatableSubscription.currentPeriodStart ??
        billingAccount?.currentPeriodStart ??
        undefined,
      currentPeriodEnd:
        updatableSubscription.currentPeriodEnd ??
        billingAccount?.currentPeriodEnd ??
        undefined,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      source: projectionSource,
    })

    return resolveAlreadyAppliedAction({
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      plan: currentPlan,
    })
  }

  try {
    const subscription = await polarClient.subscriptions.update({
      id: updatableSubscription.id,
      subscriptionUpdate: {
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      },
    })
    const resolvedPlan =
      resolvePlanFromProductId(subscription.productId) ?? currentPlan
    const resolvedSubscriptionStatus = normalizeBillingSubscriptionStatus(
      subscription.status
    )

    await upsertOrganizationBillingProjection({
      organizationId: input.organizationId,
      plan: resolvedPlan,
      subscriptionStatus: resolvedSubscriptionStatus,
      polarCustomerId:
        subscription.customerId ??
        updatableSubscription.customerId ??
        billingAccount?.polarCustomerId ??
        undefined,
      polarSubscriptionId:
        subscription.id ??
        updatableSubscription.id ??
        billingAccount?.polarSubscriptionId ??
        undefined,
      currentPeriodStart:
        subscription.currentPeriodStart ??
        updatableSubscription.currentPeriodStart ??
        billingAccount?.currentPeriodStart ??
        undefined,
      currentPeriodEnd:
        subscription.currentPeriodEnd ??
        updatableSubscription.currentPeriodEnd ??
        billingAccount?.currentPeriodEnd ??
        undefined,
      cancelAtPeriodEnd:
        subscription.cancelAtPeriodEnd ?? input.cancelAtPeriodEnd,
      source: projectionSource,
    })

    return resolveUpdatedAction({
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      plan: resolvedPlan,
    })
  } catch (error) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: getErrorMessage(error, failureMessage),
    })
  }
}

export async function cancelOrganizationSubscription(input: {
  organizationId: string
  userId: string
}): Promise<CancelOrganizationSubscriptionResult> {
  const result = await setOrganizationSubscriptionCancellation({
    organizationId: input.organizationId,
    userId: input.userId,
    cancelAtPeriodEnd: true,
  })

  if (
    result.action === "scheduled" ||
    result.action === "already_scheduled" ||
    result.action === "not_found"
  ) {
    return result
  }

  return {
    action: "scheduled",
    plan: result.plan,
  }
}

export async function uncancelOrganizationSubscription(input: {
  organizationId: string
  userId: string
}): Promise<UncancelOrganizationSubscriptionResult> {
  const result = await setOrganizationSubscriptionCancellation({
    organizationId: input.organizationId,
    userId: input.userId,
    cancelAtPeriodEnd: false,
  })

  if (
    result.action === "resumed" ||
    result.action === "already_active" ||
    result.action === "not_found"
  ) {
    return result
  }

  return {
    action: "resumed",
    plan: result.plan,
  }
}
