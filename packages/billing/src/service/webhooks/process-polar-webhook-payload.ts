import { db } from "@crikket/db"
import {
  billingWebhookEvent,
  organizationBillingAccount,
} from "@crikket/db/schema/billing"
import { and, eq, inArray, lte, or, sql } from "drizzle-orm"
import { upsertOrganizationBillingProjection } from "../entitlements/projection"
import {
  extractProviderEventId,
  extractWebhookOccurredAt,
} from "../polar-payload"
import type {
  PolarWebhookPayload,
  PolarWebhookProcessingResult,
} from "../types"
import { getErrorMessage } from "../utils"
import { isIncomingWebhookEventStale } from "./event-ordering"
import { resolveOrganizationIdFromWebhookPayload } from "./organization-resolution"
import {
  extractWebhookBillingProjection,
  hydrateBillingProjectionFromSubscription,
} from "./projection"

type WebhookClaimResult =
  | "claimed"
  | "already_processed"
  | "already_ignored"
  | "already_processing"

type WebhookEventStatus =
  | "failed"
  | "ignored"
  | "processed"
  | "processing"
  | "received"

const STALE_WEBHOOK_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000

function isTerminalWebhookStatus(
  status: string
): status is "ignored" | "processed" {
  return status === "processed" || status === "ignored"
}

async function claimWebhookEventForProcessing(input: {
  eventType: string
  payload: PolarWebhookPayload
  providerEventId: string
}): Promise<WebhookClaimResult> {
  const [insertedWebhookEvent] = await db
    .insert(billingWebhookEvent)
    .values({
      id: crypto.randomUUID(),
      providerEventId: input.providerEventId,
      provider: "polar",
      eventType: input.eventType,
      status: "received",
      payload: input.payload,
      attemptCount: 1,
    })
    .onConflictDoNothing({
      target: billingWebhookEvent.providerEventId,
    })
    .returning({
      providerEventId: billingWebhookEvent.providerEventId,
    })

  if (insertedWebhookEvent) {
    const [claimedNewEvent] = await db
      .update(billingWebhookEvent)
      .set({
        status: "processing",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(billingWebhookEvent.providerEventId, input.providerEventId),
          eq(billingWebhookEvent.status, "received")
        )
      )
      .returning({
        status: billingWebhookEvent.status,
      })

    return claimedNewEvent ? "claimed" : "already_processing"
  }

  const [existingWebhook] = await db
    .select({
      status: billingWebhookEvent.status,
      updatedAt: billingWebhookEvent.updatedAt,
    })
    .from(billingWebhookEvent)
    .where(eq(billingWebhookEvent.providerEventId, input.providerEventId))
    .limit(1)

  if (!existingWebhook) {
    return "already_processing"
  }

  if (isTerminalWebhookStatus(existingWebhook.status)) {
    return existingWebhook.status === "processed"
      ? "already_processed"
      : "already_ignored"
  }

  const staleProcessingThreshold = new Date(
    Date.now() - STALE_WEBHOOK_PROCESSING_TIMEOUT_MS
  )
  const [claimedRetry] = await db
    .update(billingWebhookEvent)
    .set({
      status: "processing",
      errorMessage: null,
      attemptCount: sql`${billingWebhookEvent.attemptCount} + 1`,
      processedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(billingWebhookEvent.providerEventId, input.providerEventId),
        or(
          inArray(billingWebhookEvent.status, ["failed", "received"]),
          and(
            eq(billingWebhookEvent.status, "processing"),
            lte(billingWebhookEvent.updatedAt, staleProcessingThreshold)
          )
        )
      )
    )
    .returning({
      status: billingWebhookEvent.status,
    })

  return claimedRetry ? "claimed" : "already_processing"
}

async function markWebhookEventStatus(input: {
  providerEventId: string
  status: WebhookEventStatus
  errorMessage?: string | null
}): Promise<void> {
  await db
    .update(billingWebhookEvent)
    .set({
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      processedAt:
        input.status === "processed" || input.status === "ignored"
          ? new Date()
          : null,
      updatedAt: new Date(),
    })
    .where(eq(billingWebhookEvent.providerEventId, input.providerEventId))
}

export async function processPolarWebhookPayload(
  payload: PolarWebhookPayload
): Promise<PolarWebhookProcessingResult> {
  const eventType =
    (typeof payload.type === "string" && payload.type.length > 0
      ? payload.type
      : "unknown") ?? "unknown"
  const providerEventId = extractProviderEventId(payload, eventType)
  const claimResult = await claimWebhookEventForProcessing({
    eventType,
    payload,
    providerEventId,
  })

  if (claimResult !== "claimed") {
    return {
      eventType,
      ignored: true,
    }
  }

  try {
    const organizationId =
      await resolveOrganizationIdFromWebhookPayload(payload)
    if (!organizationId) {
      await markWebhookEventStatus({
        providerEventId,
        status: "ignored",
      })

      return {
        eventType,
        ignored: true,
      }
    }

    const extractedProjection = extractWebhookBillingProjection(payload)
    const projection = await hydrateBillingProjectionFromSubscription({
      projection: extractedProjection,
    })
    const webhookOccurredAt = extractWebhookOccurredAt(payload)
    const currentBillingAccount =
      await db.query.organizationBillingAccount.findFirst({
        where: eq(organizationBillingAccount.organizationId, organizationId),
        columns: {
          lastWebhookAt: true,
        },
      })
    const shouldIgnoreStaleEvent = isIncomingWebhookEventStale({
      incomingOccurredAt: webhookOccurredAt,
      lastAppliedWebhookAt: currentBillingAccount?.lastWebhookAt ?? null,
    })
    if (shouldIgnoreStaleEvent) {
      await markWebhookEventStatus({
        providerEventId,
        status: "ignored",
      })

      return {
        eventType,
        ignored: true,
        organizationId,
      }
    }

    await upsertOrganizationBillingProjection({
      organizationId,
      plan: projection.plan,
      subscriptionStatus: projection.subscriptionStatus,
      polarCustomerId: projection.polarCustomerId,
      polarSubscriptionId: projection.polarSubscriptionId,
      currentPeriodStart: projection.currentPeriodStart,
      currentPeriodEnd: projection.currentPeriodEnd,
      cancelAtPeriodEnd: projection.cancelAtPeriodEnd,
      webhookOccurredAt,
      source: "webhook",
    })

    await markWebhookEventStatus({
      providerEventId,
      status: "processed",
    })

    return {
      eventType,
      ignored: false,
      organizationId,
    }
  } catch (error) {
    const message = getErrorMessage(error, "Unknown webhook processing error")

    await markWebhookEventStatus({
      providerEventId,
      status: "failed",
      errorMessage: message,
    })

    throw error
  }
}
