import { env } from "@crikket/env/server"
import { ORPCError } from "@orpc/server"
import type { BillingPlan } from "../../model"
import { getErrorMessage } from "../utils"
import {
  type HostedPaymentsEnvVar,
  resolveMissingHostedPaymentsConfiguration,
} from "./hosted-payments-configuration"
import type { BillingInterval } from "./types"

export function getMissingHostedPaymentsConfiguration(): HostedPaymentsEnvVar[] {
  return resolveMissingHostedPaymentsConfiguration({
    ENABLE_PAYMENTS: env.ENABLE_PAYMENTS,
    POLAR_ACCESS_TOKEN: env.POLAR_ACCESS_TOKEN,
    POLAR_SUCCESS_URL: env.POLAR_SUCCESS_URL,
    POLAR_WEBHOOK_SECRET: env.POLAR_WEBHOOK_SECRET,
    POLAR_PRO_PRODUCT_ID: env.POLAR_PRO_PRODUCT_ID,
    POLAR_PRO_YEARLY_PRODUCT_ID: env.POLAR_PRO_YEARLY_PRODUCT_ID,
    POLAR_STUDIO_PRODUCT_ID: env.POLAR_STUDIO_PRODUCT_ID,
    POLAR_STUDIO_YEARLY_PRODUCT_ID: env.POLAR_STUDIO_YEARLY_PRODUCT_ID,
  })
}

export function assertHostedPaymentsConfiguration(): void {
  const missingVariables = getMissingHostedPaymentsConfiguration()
  if (missingVariables.length === 0) {
    return
  }

  throw new Error(
    `ENABLE_PAYMENTS=true requires: ${missingVariables.join(", ")}`
  )
}

export function resolveProductIdByPlan(input: {
  plan: Exclude<BillingPlan, "free">
  billingInterval: BillingInterval
}): string {
  const productId =
    input.plan === "studio"
      ? input.billingInterval === "yearly"
        ? env.POLAR_STUDIO_YEARLY_PRODUCT_ID
        : env.POLAR_STUDIO_PRODUCT_ID
      : input.billingInterval === "yearly"
        ? env.POLAR_PRO_YEARLY_PRODUCT_ID
        : env.POLAR_PRO_PRODUCT_ID

  if (!productId) {
    const productPeriodSuffix =
      input.billingInterval === "yearly" ? "_YEARLY" : ""
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: `POLAR_${input.plan.toUpperCase()}${productPeriodSuffix}_PRODUCT_ID is not configured.`,
    })
  }

  return productId
}

export function assertPaymentsEnabled(): void {
  if (env.ENABLE_PAYMENTS) {
    return
  }

  throw new ORPCError("BAD_REQUEST", {
    message: "Payments are disabled in this deployment.",
  })
}

export function isPolarCustomerEmailAlreadyExistsError(
  error: unknown
): boolean {
  const message = getErrorMessage(error, "")
  if (message.includes("already exists") && message.includes("email")) {
    return true
  }

  if (!error || typeof error !== "object") {
    return false
  }

  const detail =
    "detail" in error && Array.isArray(error.detail) ? error.detail : null
  if (!detail) {
    return false
  }

  return detail.some((entry) => {
    if (!entry || typeof entry !== "object") {
      return false
    }

    const loc = "loc" in entry && Array.isArray(entry.loc) ? entry.loc : []
    const msg = "msg" in entry && typeof entry.msg === "string" ? entry.msg : ""

    return loc.includes("email") && msg.includes("already exists")
  })
}
