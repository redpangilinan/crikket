import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test"

const BILLING_SRC = `${process.cwd()}/packages/billing/src`
process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/test"
process.env.BETTER_AUTH_SECRET ??= "01234567890123456789012345678901"
process.env.BETTER_AUTH_URL ??= "http://localhost:3000"
Object.assign(process.env, { NODE_ENV: "development" })

type TestSubscription = {
  id: string
  status: string
  productId: string
  metadata: Record<string, unknown>
  customer: { externalId: string | null }
  customerId: string | null
  currentPeriodStart: Date
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

const state = {
  subscriptionsById: new Map<string, TestSubscription>(),
  metadataListResults: [] as TestSubscription[],
  customerListResults: [] as TestSubscription[],
  externalCustomerListResults: [] as TestSubscription[],
}

function resetState(): void {
  state.subscriptionsById = new Map()
  state.metadataListResults = []
  state.customerListResults = []
  state.externalCustomerListResults = []
}

mock.module(`${BILLING_SRC}/lib/payments.ts`, () => ({
  polarClient: {
    subscriptions: {
      get: (input: { id: string }) => {
        const subscription = state.subscriptionsById.get(input.id)
        if (!subscription) {
          const error = new Error("ResourceNotFound")
          ;(error as Error & { error: string }).error = "ResourceNotFound"
          throw error
        }

        return subscription
      },
      list: (input: {
        metadata?: { referenceId: string }
        customerId?: string
        externalCustomerId?: string
        page: number
      }) => {
        if (input.page !== 1) {
          return { result: { items: [] as TestSubscription[] } }
        }

        if (input.metadata?.referenceId) {
          return {
            result: {
              items: state.metadataListResults,
            },
          }
        }

        if (input.customerId) {
          return {
            result: {
              items: state.customerListResults,
            },
          }
        }

        if (input.externalCustomerId) {
          return {
            result: {
              items: state.externalCustomerListResults,
            },
          }
        }

        return { result: { items: [] as TestSubscription[] } }
      },
    },
  },
}))

let findUpdatableSubscription: typeof import("../service/checkout/subscription-discovery").findUpdatableSubscription

beforeAll(async () => {
  ;({ findUpdatableSubscription } = await import(
    `${BILLING_SRC}/service/checkout/subscription-discovery.ts`
  ))
})

beforeEach(() => {
  resetState()
})

describe("findUpdatableSubscription flow", () => {
  it("uses stored subscription id first when it is bound and updatable", async () => {
    const subscription: TestSubscription = {
      id: "sub_stored",
      status: "past_due",
      productId: "product-pro-monthly",
      metadata: {
        referenceId: "org_1",
      },
      customer: {
        externalId: "org_1",
      },
      customerId: "cus_1",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    }
    state.subscriptionsById.set(subscription.id, subscription)

    const result = await findUpdatableSubscription({
      organizationId: "org_1",
      billingAccount: {
        polarCustomerId: "cus_1",
        polarSubscriptionId: "sub_stored",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: null,
      },
    })

    expect(result?.id).toBe("sub_stored")
  })

  it("selects best metadata-matched subscription by status priority then recency", async () => {
    const olderActive: TestSubscription = {
      id: "sub_active_old",
      status: "active",
      productId: "product-pro-monthly",
      metadata: {
        referenceId: "org_1",
      },
      customer: {
        externalId: "org_1",
      },
      customerId: "cus_1",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    }
    const newerActive: TestSubscription = {
      ...olderActive,
      id: "sub_active_new",
      currentPeriodEnd: new Date("2026-03-01T00:00:00.000Z"),
    }
    const pastDueNewest: TestSubscription = {
      ...olderActive,
      id: "sub_past_due_new",
      status: "past_due",
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    }

    state.metadataListResults = [pastDueNewest, olderActive, newerActive]

    const result = await findUpdatableSubscription({
      organizationId: "org_1",
      billingAccount: null,
    })

    expect(result?.id).toBe("sub_active_new")
  })

  it("falls back to customer/external searches and keeps organization scoping", async () => {
    const wrongOrg: TestSubscription = {
      id: "sub_wrong_org",
      status: "active",
      productId: "product-pro-monthly",
      metadata: {
        referenceId: "org_2",
      },
      customer: {
        externalId: "org_2",
      },
      customerId: "cus_1",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    }
    const correctOrg: TestSubscription = {
      ...wrongOrg,
      id: "sub_correct_org",
      status: "unpaid",
      metadata: {
        referenceId: "org_1",
      },
      customer: {
        externalId: "org_1",
      },
    }

    state.customerListResults = [wrongOrg]
    state.externalCustomerListResults = [correctOrg]

    const result = await findUpdatableSubscription({
      organizationId: "org_1",
      billingAccount: {
        polarCustomerId: "cus_1",
        polarSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: null,
      },
    })

    expect(result?.id).toBe("sub_correct_org")
  })
})
