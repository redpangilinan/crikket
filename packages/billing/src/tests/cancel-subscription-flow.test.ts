import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test"

const BILLING_SRC = `${process.cwd()}/packages/billing/src`

type BillingAccountSnapshot = {
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Date | null
  currentPeriodStart: Date | null
  plan: string
  polarCustomerId: string | null
  polarSubscriptionId: string | null
  subscriptionStatus: string
}

type UpdatableSubscription = {
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: Date | null
  currentPeriodStart?: Date
  customerId?: string | null
  id: string
  productId: string
  status: string
}

const state = {
  billingAccount: null as BillingAccountSnapshot | null,
  updatableSubscription: null as UpdatableSubscription | null,
  updatedSubscription: null as UpdatableSubscription | null,
  resolvedPlanFromProductId: "pro" as "free" | "pro" | "studio" | undefined,
}

const calls = {
  assertPaymentsEnabled: 0,
  assertUserCanManageOrganizationBilling: [] as Array<{
    organizationId: string
    userId: string
  }>,
  findUpdatableSubscription: [] as Array<{
    billingAccount?: BillingAccountSnapshot | null
    organizationId: string
  }>,
  polarUpdate: [] as Array<{
    id: string
    subscriptionUpdate: { cancelAtPeriodEnd: boolean }
  }>,
  upsertOrganizationBillingProjection: [] as Record<string, unknown>[],
}

function resetState(): void {
  state.billingAccount = null
  state.updatableSubscription = null
  state.updatedSubscription = null
  state.resolvedPlanFromProductId = "pro"

  calls.assertPaymentsEnabled = 0
  calls.assertUserCanManageOrganizationBilling = []
  calls.findUpdatableSubscription = []
  calls.polarUpdate = []
  calls.upsertOrganizationBillingProjection = []
}

mock.module("@crikket/db", () => ({
  db: {
    query: {
      organizationBillingAccount: {
        findFirst: () => state.billingAccount,
      },
    },
  },
}))

mock.module(`${BILLING_SRC}/lib/payments.ts`, () => ({
  polarClient: {
    subscriptions: {
      update: (input: {
        id: string
        subscriptionUpdate: { cancelAtPeriodEnd: boolean }
      }) => {
        calls.polarUpdate.push(input)

        return (
          state.updatedSubscription ?? {
            cancelAtPeriodEnd: input.subscriptionUpdate.cancelAtPeriodEnd,
            currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
            currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
            customerId: "cus_live",
            id: input.id,
            productId: "product-pro-monthly",
            status: "active",
          }
        )
      },
    },
  },
}))

mock.module(`${BILLING_SRC}/service/access.ts`, () => ({
  assertUserCanManageOrganizationBilling: (input: {
    organizationId: string
    userId: string
  }) => {
    calls.assertUserCanManageOrganizationBilling.push(input)
  },
}))

mock.module(`${BILLING_SRC}/service/entitlements/projection.ts`, () => ({
  upsertOrganizationBillingProjection: (input: Record<string, unknown>) => {
    calls.upsertOrganizationBillingProjection.push(input)
    return {
      plan: input.plan,
      canCreateBugReports: true,
      canUploadVideo: true,
      maxVideoDurationMs: 900_000,
      memberCap: 15,
    }
  },
}))

mock.module(`${BILLING_SRC}/service/polar-payload.ts`, () => ({
  resolvePlanFromProductId: () => state.resolvedPlanFromProductId,
}))

mock.module(`${BILLING_SRC}/service/checkout/shared.ts`, () => ({
  assertPaymentsEnabled: () => {
    calls.assertPaymentsEnabled += 1
  },
  resolveProductIdByPlan: () => "product-pro-monthly",
}))

mock.module(
  `${BILLING_SRC}/service/checkout/subscription-discovery.ts`,
  () => ({
    findUpdatableSubscription: (input: {
      billingAccount?: BillingAccountSnapshot | null
      organizationId: string
    }) => {
      calls.findUpdatableSubscription.push(input)
      return Promise.resolve(state.updatableSubscription)
    },
  })
)

let cancelOrganizationSubscription: typeof import("../service/checkout/cancel-subscription").cancelOrganizationSubscription
let uncancelOrganizationSubscription: typeof import("../service/checkout/cancel-subscription").uncancelOrganizationSubscription

beforeAll(async () => {
  ;({ cancelOrganizationSubscription, uncancelOrganizationSubscription } =
    await import(`${BILLING_SRC}/service/checkout/cancel-subscription.ts`))
})

beforeEach(() => {
  resetState()
})

describe("cancelOrganizationSubscription flow", () => {
  it("schedules cancellation for an active subscription", async () => {
    state.billingAccount = {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      plan: "pro",
      polarCustomerId: "cus_1",
      polarSubscriptionId: "sub_1",
      subscriptionStatus: "active",
    }
    state.updatableSubscription = {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      customerId: "cus_1",
      id: "sub_1",
      productId: "product-pro-monthly",
      status: "active",
    }
    state.updatedSubscription = {
      ...state.updatableSubscription,
      cancelAtPeriodEnd: true,
    }

    const result = await cancelOrganizationSubscription({
      organizationId: "org_1",
      userId: "user_1",
    })

    expect(result).toEqual({
      action: "scheduled",
      plan: "pro",
    })
    expect(calls.polarUpdate).toEqual([
      {
        id: "sub_1",
        subscriptionUpdate: { cancelAtPeriodEnd: true },
      },
    ])
    expect(calls.upsertOrganizationBillingProjection).toHaveLength(1)
    expect(calls.upsertOrganizationBillingProjection[0]).toMatchObject({
      cancelAtPeriodEnd: true,
      organizationId: "org_1",
      plan: "pro",
      polarSubscriptionId: "sub_1",
      source: "manual-cancel-subscription",
      subscriptionStatus: "active",
    })
  })

  it("returns already_scheduled when cancellation is already pending", async () => {
    state.billingAccount = {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      plan: "pro",
      polarCustomerId: "cus_1",
      polarSubscriptionId: "sub_1",
      subscriptionStatus: "active",
    }
    state.updatableSubscription = {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      customerId: "cus_1",
      id: "sub_1",
      productId: "product-pro-monthly",
      status: "active",
    }

    const result = await cancelOrganizationSubscription({
      organizationId: "org_1",
      userId: "user_1",
    })

    expect(result).toEqual({
      action: "already_scheduled",
      plan: "pro",
    })
    expect(calls.polarUpdate).toEqual([])
    expect(calls.upsertOrganizationBillingProjection).toHaveLength(1)
  })

  it("returns not_found when no updatable subscription exists", async () => {
    state.billingAccount = {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      currentPeriodStart: null,
      plan: "pro",
      polarCustomerId: "cus_1",
      polarSubscriptionId: null,
      subscriptionStatus: "none",
    }
    state.updatableSubscription = null

    const result = await cancelOrganizationSubscription({
      organizationId: "org_1",
      userId: "user_1",
    })

    expect(result).toEqual({
      action: "not_found",
      plan: "pro",
    })
    expect(calls.polarUpdate).toEqual([])
    expect(calls.upsertOrganizationBillingProjection).toEqual([])
  })
})

describe("uncancelOrganizationSubscription flow", () => {
  it("resumes an already scheduled cancellation", async () => {
    state.billingAccount = {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      plan: "pro",
      polarCustomerId: "cus_1",
      polarSubscriptionId: "sub_1",
      subscriptionStatus: "active",
    }
    state.updatableSubscription = {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      customerId: "cus_1",
      id: "sub_1",
      productId: "product-pro-monthly",
      status: "active",
    }
    state.updatedSubscription = {
      ...state.updatableSubscription,
      cancelAtPeriodEnd: false,
    }

    const result = await uncancelOrganizationSubscription({
      organizationId: "org_1",
      userId: "user_1",
    })

    expect(result).toEqual({
      action: "resumed",
      plan: "pro",
    })
    expect(calls.polarUpdate).toEqual([
      {
        id: "sub_1",
        subscriptionUpdate: { cancelAtPeriodEnd: false },
      },
    ])
    expect(calls.upsertOrganizationBillingProjection).toHaveLength(1)
    expect(calls.upsertOrganizationBillingProjection[0]).toMatchObject({
      cancelAtPeriodEnd: false,
      organizationId: "org_1",
      plan: "pro",
      polarSubscriptionId: "sub_1",
      source: "manual-uncancel-subscription",
      subscriptionStatus: "active",
    })
  })

  it("returns already_active when cancellation is not pending", async () => {
    state.billingAccount = {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      plan: "pro",
      polarCustomerId: "cus_1",
      polarSubscriptionId: "sub_1",
      subscriptionStatus: "active",
    }
    state.updatableSubscription = {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      customerId: "cus_1",
      id: "sub_1",
      productId: "product-pro-monthly",
      status: "active",
    }

    const result = await uncancelOrganizationSubscription({
      organizationId: "org_1",
      userId: "user_1",
    })

    expect(result).toEqual({
      action: "already_active",
      plan: "pro",
    })
    expect(calls.polarUpdate).toEqual([])
    expect(calls.upsertOrganizationBillingProjection).toHaveLength(1)
  })
})
