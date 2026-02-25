import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test"
import { BILLING_SRC } from "./utils/paths"

type BillingAccountSnapshot = {
  polarCustomerId: string | null
  polarSubscriptionId: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean | null
}

type UpdatableSubscription = {
  id: string
  productId: string
  status: string
  customerId?: string | null
  currentPeriodStart?: Date
  currentPeriodEnd?: Date | null
  cancelAtPeriodEnd?: boolean
}

const state = {
  billingAccount: null as BillingAccountSnapshot | null,
  updatableSubscription: null as UpdatableSubscription | null,
  checkoutUrl: "https://polar.example/checkout/session",
  targetProductId: "product-pro-monthly",
  resolvedPlanFromProductId: "pro" as "free" | "pro" | "studio" | undefined,
  updatedSubscription: null as UpdatableSubscription | null,
}

const calls = {
  assertPaymentsEnabled: 0,
  assertUserCanManageOrganizationBilling: [] as Array<{
    organizationId: string
    userId: string
  }>,
  createOrganizationCheckoutSession: [] as Array<{
    organizationId: string
    plan: "pro" | "studio"
    billingInterval?: "monthly" | "yearly"
    userId: string
  }>,
  findUpdatableSubscription: [] as Array<{
    organizationId: string
    billingAccount?: BillingAccountSnapshot | null
  }>,
  polarUpdate: [] as Array<{
    id: string
    subscriptionUpdate: { productId: string }
  }>,
  upsertOrganizationBillingProjection: [] as Record<string, unknown>[],
}

function resetState(): void {
  state.billingAccount = null
  state.updatableSubscription = null
  state.checkoutUrl = "https://polar.example/checkout/session"
  state.targetProductId = "product-pro-monthly"
  state.resolvedPlanFromProductId = "pro"
  state.updatedSubscription = null

  calls.assertPaymentsEnabled = 0
  calls.assertUserCanManageOrganizationBilling = []
  calls.createOrganizationCheckoutSession = []
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
        subscriptionUpdate: { productId: string }
      }) => {
        calls.polarUpdate.push(input)
        return (
          state.updatedSubscription ?? {
            id: input.id,
            productId: input.subscriptionUpdate.productId,
            status: "active",
            customerId: "cus_live",
            currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
            currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
            cancelAtPeriodEnd: false,
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
      maxVideoDurationMs: input.plan === "studio" ? 1_200_000 : 600_000,
      memberCap: 15,
    }
  },
}))

mock.module(`${BILLING_SRC}/service/polar-payload.ts`, () => ({
  resolvePlanFromProductId: () => state.resolvedPlanFromProductId,
}))

mock.module(`${BILLING_SRC}/service/checkout/checkout-session.ts`, () => ({
  createOrganizationCheckoutSession: (input: {
    organizationId: string
    plan: "pro" | "studio"
    billingInterval?: "monthly" | "yearly"
    userId: string
  }) => {
    calls.createOrganizationCheckoutSession.push(input)
    return { url: state.checkoutUrl }
  },
}))

mock.module(`${BILLING_SRC}/service/checkout/shared.ts`, () => ({
  assertPaymentsEnabled: () => {
    calls.assertPaymentsEnabled += 1
  },
  resolveProductIdByPlan: () => state.targetProductId,
}))

mock.module(
  `${BILLING_SRC}/service/checkout/subscription-discovery.ts`,
  () => ({
    findUpdatableSubscription: (input: {
      organizationId: string
      billingAccount?: BillingAccountSnapshot | null
    }) => {
      calls.findUpdatableSubscription.push(input)
      return Promise.resolve(state.updatableSubscription)
    },
  })
)

let changeOrganizationPlan: typeof import("../src/service/checkout/plan-change").changeOrganizationPlan

beforeAll(async () => {
  ;({ changeOrganizationPlan } = await import(
    `${BILLING_SRC}/service/checkout/plan-change.ts`
  ))
})

beforeEach(() => {
  resetState()
})

afterAll(() => {
  mock.restore()
})

describe("changeOrganizationPlan flow", () => {
  it("returns checkout_required when no updatable subscription exists", async () => {
    const result = await changeOrganizationPlan({
      organizationId: "org_1",
      plan: "pro",
      billingInterval: "monthly",
      userId: "user_1",
    })

    expect(result).toEqual({
      action: "checkout_required",
      plan: "pro",
      url: state.checkoutUrl,
    })
    expect(calls.assertPaymentsEnabled).toBe(1)
    expect(calls.assertUserCanManageOrganizationBilling).toEqual([
      {
        organizationId: "org_1",
        userId: "user_1",
      },
    ])
    expect(calls.createOrganizationCheckoutSession).toEqual([
      {
        billingInterval: "monthly",
        organizationId: "org_1",
        plan: "pro",
        userId: "user_1",
      },
    ])
  })

  it("returns unchanged when existing subscription already matches plan and cadence", async () => {
    state.updatableSubscription = {
      id: "sub_1",
      productId: "product-pro-monthly",
      status: "active",
      customerId: "cus_1",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    }

    const result = await changeOrganizationPlan({
      organizationId: "org_1",
      plan: "pro",
      billingInterval: "monthly",
      userId: "user_1",
    })

    expect(result).toEqual({
      action: "unchanged",
      plan: "pro",
    })
    expect(calls.polarUpdate).toEqual([])
    expect(calls.upsertOrganizationBillingProjection).toHaveLength(1)
    expect(calls.upsertOrganizationBillingProjection[0]).toMatchObject({
      organizationId: "org_1",
      plan: "pro",
      polarSubscriptionId: "sub_1",
      source: "manual-change-plan",
      subscriptionStatus: "active",
    })
  })

  it("updates existing subscription when plan/cadence differs", async () => {
    state.targetProductId = "product-studio-yearly"
    state.resolvedPlanFromProductId = "studio"
    state.updatableSubscription = {
      id: "sub_2",
      productId: "product-pro-monthly",
      status: "past_due",
      customerId: "cus_2",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      cancelAtPeriodEnd: true,
    }
    state.updatedSubscription = {
      id: "sub_2",
      productId: "product-studio-yearly",
      status: "active",
      customerId: "cus_2",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    }

    const result = await changeOrganizationPlan({
      organizationId: "org_1",
      plan: "studio",
      billingInterval: "yearly",
      userId: "user_1",
    })

    expect(result).toEqual({
      action: "updated",
      plan: "studio",
    })
    expect(calls.polarUpdate).toEqual([
      {
        id: "sub_2",
        subscriptionUpdate: {
          productId: "product-studio-yearly",
        },
      },
    ])
    expect(calls.upsertOrganizationBillingProjection).toHaveLength(1)
    expect(calls.upsertOrganizationBillingProjection[0]).toMatchObject({
      organizationId: "org_1",
      plan: "studio",
      polarSubscriptionId: "sub_2",
      source: "manual-change-plan",
      subscriptionStatus: "active",
    })
  })
})
