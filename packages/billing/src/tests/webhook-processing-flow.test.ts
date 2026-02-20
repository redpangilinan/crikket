import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test"

const BILLING_SRC = `${process.cwd()}/packages/billing/src`

const billingWebhookEvent = {
  __table: "billingWebhookEvent",
  providerEventId: { __column: "providerEventId" },
  status: { __column: "status" },
  updatedAt: { __column: "updatedAt" },
  processedAt: { __column: "processedAt" },
  errorMessage: { __column: "errorMessage" },
  attemptCount: { __column: "attemptCount" },
  eventType: { __column: "eventType" },
  payload: { __column: "payload" },
}

const organizationBillingAccount = {
  __table: "organizationBillingAccount",
  organizationId: { __column: "organizationId" },
  lastWebhookAt: { __column: "lastWebhookAt" },
}

type Condition =
  | {
      op: "eq"
      column: { __column: string }
      value: unknown
    }
  | {
      op: "and"
      conditions: Condition[]
    }
  | {
      op: "or"
      conditions: Condition[]
    }
  | {
      op: "inArray"
      column: { __column: string }
      values: unknown[]
    }
  | {
      op: "lte"
      column: { __column: string }
      value: unknown
    }

type SqlExpr = {
  op: "sql"
  strings: string[]
  values: unknown[]
}

type EventRow = {
  id: string
  providerEventId: string
  provider: string
  eventType: string
  status: string
  payload: unknown
  attemptCount: number
  processedAt: Date | null
  errorMessage: string | null
  receivedAt: Date
  createdAt: Date
  updatedAt: Date
}

type BillingAccountRow = {
  organizationId: string
  lastWebhookAt: Date | null
}

const state = {
  events: new Map<string, EventRow>(),
  billingAccounts: new Map<string, BillingAccountRow>(),
  resolvedOrganizationId: "org_1" as string | undefined,
  providerEventId: "polar:event:evt_1",
  webhookOccurredAt: new Date("2026-01-01T00:00:00.000Z") as Date | undefined,
  extractedProjection: {
    plan: "pro",
    subscriptionStatus: "active",
    polarCustomerId: "cus_1",
    polarSubscriptionId: "sub_1",
    currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
  },
  hydratedProjection: {
    plan: "pro",
    subscriptionStatus: "active",
    polarCustomerId: "cus_1",
    polarSubscriptionId: "sub_1",
    currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
  },
  upsertCalls: [] as Record<string, unknown>[],
}

function resetState(): void {
  state.events = new Map()
  state.billingAccounts = new Map()
  state.resolvedOrganizationId = "org_1"
  state.providerEventId = "polar:event:evt_1"
  state.webhookOccurredAt = new Date("2026-01-01T00:00:00.000Z")
  state.extractedProjection = {
    plan: "pro",
    subscriptionStatus: "active",
    polarCustomerId: "cus_1",
    polarSubscriptionId: "sub_1",
    currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
  }
  state.hydratedProjection = {
    ...state.extractedProjection,
  }
  state.upsertCalls = []
}

function evalCondition(
  row: Record<string, unknown>,
  condition: Condition
): boolean {
  if (condition.op === "eq") {
    return row[condition.column.__column] === condition.value
  }

  if (condition.op === "inArray") {
    return condition.values.includes(row[condition.column.__column])
  }

  if (condition.op === "lte") {
    const rowValue = row[condition.column.__column]
    if (rowValue instanceof Date && condition.value instanceof Date) {
      return rowValue.getTime() <= condition.value.getTime()
    }

    return false
  }

  if (condition.op === "and") {
    return condition.conditions.every((innerCondition) =>
      evalCondition(row, innerCondition)
    )
  }

  return condition.conditions.some((innerCondition) =>
    evalCondition(row, innerCondition)
  )
}

function applySetToEventRow(
  row: EventRow,
  setValue: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(setValue)) {
    if (
      key === "attemptCount" &&
      value &&
      typeof value === "object" &&
      "op" in value &&
      (value as { op?: string }).op === "sql"
    ) {
      const sqlExpr = value as SqlExpr
      const isIncrementExpression = sqlExpr.strings.join("").includes("+ 1")
      if (isIncrementExpression) {
        row.attemptCount += 1
      }
      continue
    }

    ;(row as Record<string, unknown>)[key] = value
  }
}

function selectShape<Row extends Record<string, unknown>>(
  row: Row,
  shape: Record<string, { __column: string }>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, column] of Object.entries(shape)) {
    result[key] = row[column.__column]
  }

  return result
}

mock.module("@crikket/db/schema/billing", () => ({
  billingWebhookEvent,
  organizationBillingAccount,
}))

mock.module("drizzle-orm", () => ({
  eq: (column: { __column: string }, value: unknown): Condition => ({
    op: "eq",
    column,
    value,
  }),
  and: (...conditions: Condition[]): Condition => ({
    op: "and",
    conditions,
  }),
  or: (...conditions: Condition[]): Condition => ({
    op: "or",
    conditions,
  }),
  inArray: (column: { __column: string }, values: unknown[]): Condition => ({
    op: "inArray",
    column,
    values,
  }),
  lte: (column: { __column: string }, value: unknown): Condition => ({
    op: "lte",
    column,
    value,
  }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]): SqlExpr => ({
    op: "sql",
    strings: [...strings],
    values,
  }),
}))

mock.module("@crikket/db", () => ({
  db: {
    insert: (table: { __table: string }) => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: (shape: Record<string, { __column: string }>) => {
            if (table.__table !== "billingWebhookEvent") {
              return []
            }

            const providerEventId = value.providerEventId as string
            if (state.events.has(providerEventId)) {
              return []
            }

            const now = new Date()
            const eventRow: EventRow = {
              id: (value.id as string) ?? crypto.randomUUID(),
              providerEventId,
              provider: (value.provider as string) ?? "polar",
              eventType: (value.eventType as string) ?? "unknown",
              status: (value.status as string) ?? "received",
              payload: value.payload,
              attemptCount: (value.attemptCount as number) ?? 1,
              processedAt: null,
              errorMessage: null,
              receivedAt: now,
              createdAt: now,
              updatedAt: now,
            }
            state.events.set(providerEventId, eventRow)

            return [selectShape(eventRow, shape)]
          },
        }),
      }),
    }),
    select: (shape: Record<string, { __column: string }>) => ({
      from: () => ({
        where: (condition: Condition) => ({
          limit: (limit: number) => {
            const rows = [...state.events.values()]
              .filter((row) =>
                evalCondition(row as Record<string, unknown>, condition)
              )
              .slice(0, limit)
            return rows.map((row) => selectShape(row, shape))
          },
        }),
      }),
    }),
    update: () => ({
      set: (setValue: Record<string, unknown>) => ({
        where: (condition: Condition) => {
          const updatedRows = [...state.events.values()].filter((row) =>
            evalCondition(row as Record<string, unknown>, condition)
          )

          for (const row of updatedRows) {
            applySetToEventRow(row, setValue)
          }

          return {
            returning: (shape: Record<string, { __column: string }>) =>
              updatedRows.map((row) => selectShape(row, shape)),
          }
        },
      }),
    }),
    query: {
      organizationBillingAccount: {
        findFirst: (input: {
          where: Condition
          columns: Record<string, boolean>
        }) => {
          const rows = [...state.billingAccounts.values()].filter((row) =>
            evalCondition(row as Record<string, unknown>, input.where)
          )
          const row = rows[0]
          if (!row) {
            return null
          }

          const selected: Record<string, unknown> = {}
          for (const columnName of Object.keys(input.columns)) {
            selected[columnName] = (row as Record<string, unknown>)[columnName]
          }

          return selected
        },
      },
    },
  },
}))

mock.module(`${BILLING_SRC}/service/polar-payload.ts`, () => ({
  extractProviderEventId: () => state.providerEventId,
  extractWebhookOccurredAt: () => state.webhookOccurredAt,
}))

mock.module(
  `${BILLING_SRC}/service/webhooks/organization-resolution.ts`,
  () => ({
    resolveOrganizationIdFromWebhookPayload: () => state.resolvedOrganizationId,
  })
)

mock.module(`${BILLING_SRC}/service/webhooks/projection.ts`, () => ({
  extractWebhookBillingProjection: () => state.extractedProjection,
  hydrateBillingProjectionFromSubscription: () => state.hydratedProjection,
}))

mock.module(`${BILLING_SRC}/service/entitlements/projection.ts`, () => ({
  upsertOrganizationBillingProjection: (input: Record<string, unknown>) => {
    state.upsertCalls.push(input)
    return {
      plan: input.plan,
      canCreateBugReports: true,
      canUploadVideo: true,
      maxVideoDurationMs: 900_000,
      memberCap: 15,
    }
  },
}))

let processPolarWebhookPayload: typeof import("../service/webhooks/process-polar-webhook-payload").processPolarWebhookPayload

beforeAll(async () => {
  ;({ processPolarWebhookPayload } = await import(
    `${BILLING_SRC}/service/webhooks/process-polar-webhook-payload.ts`
  ))
})

beforeEach(() => {
  resetState()
})

describe("processPolarWebhookPayload flow", () => {
  it("processes a new webhook event and writes projection", async () => {
    state.billingAccounts.set("org_1", {
      organizationId: "org_1",
      lastWebhookAt: null,
    })

    const result = await processPolarWebhookPayload({
      type: "subscription.updated",
      data: {
        id: "evt_1",
      },
    })

    expect(result).toEqual({
      eventType: "subscription.updated",
      ignored: false,
      organizationId: "org_1",
    })
    expect(state.upsertCalls).toHaveLength(1)
    expect(state.upsertCalls[0]).toMatchObject({
      organizationId: "org_1",
      source: "webhook",
      webhookOccurredAt: state.webhookOccurredAt,
    })

    const storedEvent = state.events.get(state.providerEventId)
    expect(storedEvent?.status).toBe("processed")
    expect(storedEvent?.processedAt).toBeInstanceOf(Date)
  })

  it("ignores stale webhook events older than last applied webhook", async () => {
    state.billingAccounts.set("org_1", {
      organizationId: "org_1",
      lastWebhookAt: new Date("2026-01-02T00:00:00.000Z"),
    })
    state.webhookOccurredAt = new Date("2026-01-01T00:00:00.000Z")

    const result = await processPolarWebhookPayload({
      type: "subscription.updated",
      data: {
        id: "evt_2",
      },
    })

    expect(result).toEqual({
      eventType: "subscription.updated",
      ignored: true,
      organizationId: "org_1",
    })
    expect(state.upsertCalls).toHaveLength(0)

    const storedEvent = state.events.get(state.providerEventId)
    expect(storedEvent?.status).toBe("ignored")
  })

  it("reclaims stale processing events and retries processing", async () => {
    const staleUpdatedAt = new Date(Date.now() - 6 * 60 * 1000)
    state.events.set(state.providerEventId, {
      id: crypto.randomUUID(),
      providerEventId: state.providerEventId,
      provider: "polar",
      eventType: "subscription.updated",
      status: "processing",
      payload: {},
      attemptCount: 2,
      processedAt: null,
      errorMessage: null,
      receivedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: staleUpdatedAt,
    })
    state.billingAccounts.set("org_1", {
      organizationId: "org_1",
      lastWebhookAt: null,
    })

    const result = await processPolarWebhookPayload({
      type: "subscription.updated",
      data: {
        id: "evt_3",
      },
    })

    expect(result.ignored).toBe(false)
    expect(state.upsertCalls).toHaveLength(1)

    const storedEvent = state.events.get(state.providerEventId)
    expect(storedEvent?.status).toBe("processed")
    expect(storedEvent?.attemptCount).toBe(3)
  })
})
