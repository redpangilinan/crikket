import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test"

// Regression coverage for the object existence check used at finalize, which
// previously swallowed *every* error and reported the object as
// missing ("Capture upload has not completed yet."), which hid a real
// 403 SignatureDoesNotMatch. These helpers now drive the decision: only a
// genuine "not found" is false, a zero-byte object is present, and anything
// else must surface.

const envState = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/crikket",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  STORAGE_BUCKET: "bug-report-bucket",
  STORAGE_REGION: "auto",
  STORAGE_ENDPOINT: "https://example-account.r2.cloudflarestorage.com",
  STORAGE_ADDRESSING_STYLE: undefined,
  STORAGE_ACCESS_KEY_ID: "access",
  STORAGE_SECRET_ACCESS_KEY: "secret",
  STORAGE_PUBLIC_URL: undefined,
}

mock.module("@crikket/env/server", () => ({ env: envState }))
mock.module("@crikket/db", () => ({
  db: {
    query: {
      bugReportArtifactCleanup: {
        findMany: async () => [],
        findFirst: async () => null,
      },
    },
    delete: () => ({ where: async () => undefined }),
    insert: () => ({
      values: () => ({ onConflictDoUpdate: async () => undefined }),
    }),
  },
}))
mock.module("@crikket/shared/lib/errors", () => ({
  reportNonFatalError: () => undefined,
}))

let isStorageNotFoundError: typeof import("../src/lib/storage").isStorageNotFoundError
let isRangeNotSatisfiableError: typeof import("../src/lib/storage").isRangeNotSatisfiableError

beforeAll(async () => {
  ;({ isStorageNotFoundError, isRangeNotSatisfiableError } = await import(
    "../src/lib/storage"
  ))
})

afterAll(() => {
  mock.restore()
})

describe("isStorageNotFoundError", () => {
  it("recognises a 404 status", () => {
    expect(isStorageNotFoundError({ $metadata: { httpStatusCode: 404 } })).toBe(
      true
    )
  })

  it("recognises NoSuchKey / NotFound by name", () => {
    expect(isStorageNotFoundError({ name: "NoSuchKey" })).toBe(true)
    expect(isStorageNotFoundError({ name: "NotFound" })).toBe(true)
  })

  it("does NOT treat a 403 SignatureDoesNotMatch as missing", () => {
    expect(
      isStorageNotFoundError({
        name: "SignatureDoesNotMatch",
        $metadata: { httpStatusCode: 403 },
      })
    ).toBe(false)
  })

  it("does NOT treat a 500 as missing", () => {
    expect(isStorageNotFoundError({ $metadata: { httpStatusCode: 500 } })).toBe(
      false
    )
  })
})

describe("isRangeNotSatisfiableError", () => {
  it("recognises a 416 status (zero-byte object)", () => {
    expect(
      isRangeNotSatisfiableError({ $metadata: { httpStatusCode: 416 } })
    ).toBe(true)
  })

  it("recognises InvalidRange by name", () => {
    expect(isRangeNotSatisfiableError({ name: "InvalidRange" })).toBe(true)
  })

  it("does NOT match a 403", () => {
    expect(
      isRangeNotSatisfiableError({ $metadata: { httpStatusCode: 403 } })
    ).toBe(false)
  })
})
