import { db } from "@crikket/db"
import {
  organizationBillingAccount,
  organizationEntitlement,
} from "@crikket/db/schema/billing"
import { eq, isNull, lte, or } from "drizzle-orm"

import {
  type EntitlementSnapshot,
  normalizeBillingPlan,
  normalizeBillingSubscriptionStatus,
  resolveEntitlements,
  serializeEntitlements,
} from "../../model"
import type { BillingProjectionInput } from "../types"
import { asRecord } from "../utils"

type BillingProjectionTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0]

type ExistingBillingAccountSnapshot = {
  plan: string
  subscriptionStatus: string
  lastWebhookAt: Date | null
}

function resolveEntitlementsFromBillingAccount(
  billingAccount: ExistingBillingAccountSnapshot | undefined
): EntitlementSnapshot {
  return resolveEntitlements({
    plan: normalizeBillingPlan(billingAccount?.plan),
    subscriptionStatus: normalizeBillingSubscriptionStatus(
      billingAccount?.subscriptionStatus
    ),
  })
}

function isWebhookProjectionStale(input: {
  existingBillingAccount: ExistingBillingAccountSnapshot | undefined
  webhookOccurredAt?: Date
}): boolean {
  if (
    !(input.existingBillingAccount?.lastWebhookAt && input.webhookOccurredAt)
  ) {
    return false
  }

  return (
    input.webhookOccurredAt.getTime() <
    input.existingBillingAccount.lastWebhookAt.getTime()
  )
}

function getWebhookOrderingGuard(webhookOccurredAt?: Date) {
  if (!webhookOccurredAt) {
    return undefined
  }

  return or(
    isNull(organizationBillingAccount.lastWebhookAt),
    lte(organizationBillingAccount.lastWebhookAt, webhookOccurredAt)
  )
}

async function getProjectionBaseRows(
  tx: BillingProjectionTransaction,
  organizationId: string
): Promise<{
  existingBillingAccount: ExistingBillingAccountSnapshot | undefined
  existingEntitlementRow: { entitlements: unknown } | undefined
}> {
  const [existingBillingAccount, existingEntitlementRow] = await Promise.all([
    tx
      .select({
        plan: organizationBillingAccount.plan,
        subscriptionStatus: organizationBillingAccount.subscriptionStatus,
        lastWebhookAt: organizationBillingAccount.lastWebhookAt,
      })
      .from(organizationBillingAccount)
      .where(eq(organizationBillingAccount.organizationId, organizationId))
      .limit(1)
      .for("update")
      .then((rows) => rows[0]),
    tx.query.organizationEntitlement.findFirst({
      where: eq(organizationEntitlement.organizationId, organizationId),
      columns: {
        entitlements: true,
      },
    }),
  ])

  return { existingBillingAccount, existingEntitlementRow }
}

async function upsertBillingAccountSnapshot(input: {
  tx: BillingProjectionTransaction
  projection: BillingProjectionInput
  nextPlan: ReturnType<typeof normalizeBillingPlan>
  nextSubscriptionStatus: ReturnType<typeof normalizeBillingSubscriptionStatus>
  webhookOccurredAt?: Date
}): Promise<{ plan: string; subscriptionStatus: string } | undefined> {
  const webhookOrderingGuard = getWebhookOrderingGuard(input.webhookOccurredAt)
  const [upsertedBillingAccount] = await input.tx
    .insert(organizationBillingAccount)
    .values({
      organizationId: input.projection.organizationId,
      provider: "polar",
      polarCustomerId: input.projection.polarCustomerId,
      polarSubscriptionId: input.projection.polarSubscriptionId,
      plan: input.nextPlan,
      subscriptionStatus: input.nextSubscriptionStatus,
      currentPeriodStart: input.projection.currentPeriodStart,
      currentPeriodEnd: input.projection.currentPeriodEnd,
      cancelAtPeriodEnd: input.projection.cancelAtPeriodEnd ?? false,
      lastWebhookAt: input.webhookOccurredAt,
    })
    .onConflictDoUpdate({
      target: organizationBillingAccount.organizationId,
      set: {
        polarCustomerId:
          input.projection.polarCustomerId ??
          organizationBillingAccount.polarCustomerId,
        polarSubscriptionId:
          input.projection.polarSubscriptionId ??
          organizationBillingAccount.polarSubscriptionId,
        plan: input.nextPlan,
        subscriptionStatus: input.nextSubscriptionStatus,
        currentPeriodStart:
          input.projection.currentPeriodStart ??
          organizationBillingAccount.currentPeriodStart,
        currentPeriodEnd:
          input.projection.currentPeriodEnd ??
          organizationBillingAccount.currentPeriodEnd,
        cancelAtPeriodEnd:
          input.projection.cancelAtPeriodEnd ??
          organizationBillingAccount.cancelAtPeriodEnd,
        lastWebhookAt:
          input.webhookOccurredAt ?? organizationBillingAccount.lastWebhookAt,
        updatedAt: new Date(),
      },
      ...(webhookOrderingGuard
        ? {
            setWhere: webhookOrderingGuard,
          }
        : {}),
    })
    .returning({
      plan: organizationBillingAccount.plan,
      subscriptionStatus: organizationBillingAccount.subscriptionStatus,
    })

  return upsertedBillingAccount
}

async function persistEntitlementProjection(input: {
  tx: BillingProjectionTransaction
  projection: BillingProjectionInput
  entitlements: EntitlementSnapshot
  existingEntitlements: unknown
}): Promise<void> {
  const nextEntitlementsPayload = {
    ...(asRecord(input.existingEntitlements) ?? {}),
    ...serializeEntitlements(input.entitlements),
  }

  await input.tx
    .insert(organizationEntitlement)
    .values({
      organizationId: input.projection.organizationId,
      plan: input.entitlements.plan,
      entitlements: nextEntitlementsPayload,
      lastComputedAt: new Date(),
      source: input.projection.source ?? "reconciliation",
    })
    .onConflictDoUpdate({
      target: organizationEntitlement.organizationId,
      set: {
        plan: input.entitlements.plan,
        entitlements: nextEntitlementsPayload,
        lastComputedAt: new Date(),
        source: input.projection.source ?? "reconciliation",
        updatedAt: new Date(),
      },
    })
}

export function upsertOrganizationBillingProjection(
  input: BillingProjectionInput
): Promise<EntitlementSnapshot> {
  return db.transaction(async (tx) => {
    const isWebhookProjection = input.source === "webhook"
    const webhookOccurredAt = isWebhookProjection
      ? (input.webhookOccurredAt ?? new Date())
      : undefined

    const { existingBillingAccount, existingEntitlementRow } =
      await getProjectionBaseRows(tx, input.organizationId)

    const nextPlan = normalizeBillingPlan(
      input.plan ?? existingBillingAccount?.plan
    )
    const nextSubscriptionStatus = normalizeBillingSubscriptionStatus(
      input.subscriptionStatus ?? existingBillingAccount?.subscriptionStatus
    )

    if (
      isWebhookProjection &&
      isWebhookProjectionStale({
        existingBillingAccount,
        webhookOccurredAt,
      })
    ) {
      return resolveEntitlementsFromBillingAccount(existingBillingAccount)
    }

    const upsertedBillingAccount = await upsertBillingAccountSnapshot({
      tx,
      projection: input,
      nextPlan,
      nextSubscriptionStatus,
      webhookOccurredAt,
    })

    if (!upsertedBillingAccount) {
      return resolveEntitlementsFromBillingAccount(existingBillingAccount)
    }

    const entitlements = resolveEntitlements({
      plan: normalizeBillingPlan(upsertedBillingAccount.plan),
      subscriptionStatus: normalizeBillingSubscriptionStatus(
        upsertedBillingAccount.subscriptionStatus
      ),
    })

    await persistEntitlementProjection({
      tx,
      projection: input,
      entitlements,
      existingEntitlements: existingEntitlementRow?.entitlements,
    })

    return entitlements
  })
}
