import { createHash } from "node:crypto"
import { env } from "@crikket/env/server"

import {
  BILLING_PLAN,
  type BillingPlan,
  type BillingSubscriptionStatus,
  normalizeBillingSubscriptionStatus,
} from "../model"
import type { PolarWebhookPayload } from "./types"
import {
  asRecord,
  findFirstStringByKeys,
  getNestedString,
  toDateOrUndefined,
} from "./utils"

function normalizeForStableJson(
  value: unknown,
  seen: WeakSet<object>
): unknown {
  if (value === null || typeof value !== "object") {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (seen.has(value)) {
    return "[circular]"
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForStableJson(entry, seen))
  }

  const record = value as Record<string, unknown>
  const normalizedRecord: Record<string, unknown> = {}
  const sortedKeys = Object.keys(record).sort()

  for (const key of sortedKeys) {
    normalizedRecord[key] = normalizeForStableJson(record[key], seen)
  }

  return normalizedRecord
}

function serializeStablePayloadForHash(payload: PolarWebhookPayload): string {
  try {
    const normalized = normalizeForStableJson(payload, new WeakSet<object>())
    return JSON.stringify(normalized)
  } catch {
    return ""
  }
}

export function resolvePlanFromProductId(
  productId: string | undefined
): BillingPlan | undefined {
  if (!productId) {
    return undefined
  }

  if (
    productId === env.POLAR_STUDIO_PRODUCT_ID ||
    productId === env.POLAR_STUDIO_YEARLY_PRODUCT_ID
  ) {
    return BILLING_PLAN.studio
  }

  if (
    productId === env.POLAR_PRO_PRODUCT_ID ||
    productId === env.POLAR_PRO_YEARLY_PRODUCT_ID
  ) {
    return BILLING_PLAN.pro
  }

  return undefined
}

export function extractReferenceId(
  payload: PolarWebhookPayload
): string | undefined {
  return (
    getNestedString(payload, ["data", "referenceId"]) ??
    getNestedString(payload, ["data", "metadata", "referenceId"]) ??
    getNestedString(payload, [
      "data",
      "subscription",
      "metadata",
      "referenceId",
    ]) ??
    findFirstStringByKeys(payload.data, ["referenceId", "reference_id"])
  )
}

export function extractReferenceIdFromMetadata(
  metadata: unknown
): string | undefined {
  const metadataRecord = asRecord(metadata)
  if (!metadataRecord) {
    return undefined
  }

  const referenceId = metadataRecord.referenceId ?? metadataRecord.reference_id
  return typeof referenceId === "string" && referenceId.length > 0
    ? referenceId
    : undefined
}

export function extractProductId(
  payload: PolarWebhookPayload
): string | undefined {
  return (
    getNestedString(payload, ["data", "productId"]) ??
    getNestedString(payload, ["data", "product", "id"]) ??
    getNestedString(payload, ["data", "productPrice", "productId"]) ??
    getNestedString(payload, ["data", "productPrice", "product", "id"]) ??
    findFirstStringByKeys(payload.data, ["productId", "product_id"])
  )
}

export function extractSubscriptionStatus(
  payload: PolarWebhookPayload
): BillingSubscriptionStatus | undefined {
  const payloadData = asRecord(payload.data)
  const subscriptionData = asRecord(payloadData?.subscription)
  const rawStatus =
    (typeof payloadData?.status === "string"
      ? payloadData.status
      : undefined) ??
    (typeof subscriptionData?.status === "string"
      ? subscriptionData.status
      : undefined) ??
    getNestedString(payload, ["data", "status"]) ??
    getNestedString(payload, ["data", "subscription", "status"]) ??
    getNestedString(payload, ["data", "subscription_status"])

  return rawStatus ? normalizeBillingSubscriptionStatus(rawStatus) : undefined
}

export function extractCustomerId(
  payload: PolarWebhookPayload
): string | undefined {
  return (
    getNestedString(payload, ["data", "customerId"]) ??
    getNestedString(payload, ["data", "customer", "id"]) ??
    getNestedString(payload, ["data", "customer_id"])
  )
}

export function extractSubscriptionId(
  payload: PolarWebhookPayload
): string | undefined {
  const eventType = typeof payload.type === "string" ? payload.type : ""
  const canFallbackToResourceId = eventType.startsWith("subscription.")

  return (
    getNestedString(payload, ["data", "subscriptionId"]) ??
    getNestedString(payload, ["data", "subscription", "id"]) ??
    getNestedString(payload, ["data", "subscription_id"]) ??
    (canFallbackToResourceId
      ? getNestedString(payload, ["data", "id"])
      : undefined)
  )
}

export function extractCheckoutId(
  payload: PolarWebhookPayload
): string | undefined {
  return (
    getNestedString(payload, ["data", "checkoutId"]) ??
    getNestedString(payload, ["data", "checkout", "id"]) ??
    getNestedString(payload, ["data", "subscription", "checkoutId"]) ??
    getNestedString(payload, ["data", "subscription", "checkout", "id"]) ??
    findFirstStringByKeys(payload.data, ["checkoutId", "checkout_id"])
  )
}

export function extractCurrentPeriodStart(
  payload: PolarWebhookPayload
): Date | undefined {
  const payloadData = asRecord(payload.data)
  const subscriptionData = asRecord(payloadData?.subscription)
  const value =
    payloadData?.currentPeriodStart ??
    payloadData?.currentPeriodStartAt ??
    subscriptionData?.currentPeriodStart ??
    subscriptionData?.currentPeriodStartAt ??
    payloadData?.current_period_start ??
    payloadData?.current_period_start_at ??
    getNestedString(payload, ["data", "currentPeriodStart"]) ??
    getNestedString(payload, ["data", "currentPeriodStartAt"]) ??
    getNestedString(payload, ["data", "subscription", "currentPeriodStart"]) ??
    getNestedString(payload, [
      "data",
      "subscription",
      "currentPeriodStartAt",
    ]) ??
    getNestedString(payload, ["data", "current_period_start"]) ??
    getNestedString(payload, ["data", "current_period_start_at"])

  return toDateOrUndefined(value)
}

export function extractCurrentPeriodEnd(
  payload: PolarWebhookPayload
): Date | undefined {
  const payloadData = asRecord(payload.data)
  const subscriptionData = asRecord(payloadData?.subscription)
  const value =
    payloadData?.currentPeriodEnd ??
    payloadData?.currentPeriodEndAt ??
    subscriptionData?.currentPeriodEnd ??
    subscriptionData?.currentPeriodEndAt ??
    payloadData?.current_period_end ??
    payloadData?.current_period_end_at ??
    payloadData?.endedAt ??
    getNestedString(payload, ["data", "currentPeriodEnd"]) ??
    getNestedString(payload, ["data", "currentPeriodEndAt"]) ??
    getNestedString(payload, ["data", "subscription", "currentPeriodEnd"]) ??
    getNestedString(payload, ["data", "subscription", "currentPeriodEndAt"]) ??
    getNestedString(payload, ["data", "current_period_end"]) ??
    getNestedString(payload, ["data", "current_period_end_at"]) ??
    getNestedString(payload, ["data", "endedAt"])

  return toDateOrUndefined(value)
}

export function extractCancelAtPeriodEnd(
  payload: PolarWebhookPayload
): boolean | undefined {
  const payloadData = asRecord(payload.data)
  const subscriptionData = asRecord(payloadData?.subscription)
  const value =
    payloadData?.cancelAtPeriodEnd ??
    payloadData?.cancel_at_period_end ??
    subscriptionData?.cancelAtPeriodEnd ??
    subscriptionData?.cancel_at_period_end ??
    getNestedString(payload, ["data", "cancelAtPeriodEnd"]) ??
    getNestedString(payload, ["data", "subscription", "cancelAtPeriodEnd"]) ??
    getNestedString(payload, ["data", "cancel_at_period_end"])
  if (typeof value === "boolean") {
    return value
  }

  if (value === "true") {
    return true
  }

  if (value === "false") {
    return false
  }

  return undefined
}

export function extractWebhookOccurredAt(
  payload: PolarWebhookPayload
): Date | undefined {
  const payloadData = asRecord(payload.data)
  const value =
    payloadData?.createdAt ??
    payloadData?.created_at ??
    payloadData?.occurredAt ??
    payloadData?.occurred_at ??
    getNestedString(payload, ["createdAt"]) ??
    getNestedString(payload, ["created_at"]) ??
    getNestedString(payload, ["data", "createdAt"]) ??
    getNestedString(payload, ["data", "created_at"]) ??
    getNestedString(payload, ["data", "occurredAt"]) ??
    getNestedString(payload, ["data", "occurred_at"])

  return toDateOrUndefined(value)
}

export function extractProviderEventId(
  payload: PolarWebhookPayload,
  eventType: string
): string {
  const eventId =
    getNestedString(payload, ["id"]) ??
    getNestedString(payload, ["data", "eventId"]) ??
    getNestedString(payload, ["data", "event_id"])

  if (eventId && eventId.length > 0) {
    return `polar:event:${eventId}`
  }

  const secondaryId =
    getNestedString(payload, ["data", "id"]) ??
    getNestedString(payload, ["data", "subscriptionId"]) ??
    getNestedString(payload, ["data", "subscription_id"]) ??
    getNestedString(payload, ["data", "checkoutId"]) ??
    getNestedString(payload, ["data", "checkout_id"]) ??
    "unknown"
  const serializedPayload = serializeStablePayloadForHash(payload)
  const payloadFingerprint = createHash("sha256")
    .update(eventType)
    .update(":")
    .update(secondaryId)
    .update(":")
    .update(serializedPayload)
    .digest("hex")
    .slice(0, 32)

  return `polar:fallback:${eventType}:${secondaryId}:${payloadFingerprint}`
}
