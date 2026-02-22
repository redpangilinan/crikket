import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test"

const envState: {
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  STORAGE_BUCKET: string
  STORAGE_REGION: string
  STORAGE_ENDPOINT: string
  STORAGE_ACCESS_KEY_ID: string
  STORAGE_SECRET_ACCESS_KEY: string
  STORAGE_PUBLIC_URL: string | undefined
} = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/crikket",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  STORAGE_BUCKET: "bug-report-bucket",
  STORAGE_REGION: "us-east-1",
  STORAGE_ENDPOINT: "https://s3.us-east-1.amazonaws.com",
  STORAGE_ACCESS_KEY_ID: "access",
  STORAGE_SECRET_ACCESS_KEY: "secret",
  STORAGE_PUBLIC_URL: "https://cdn.example.com/bug-reports",
}

mock.module("@crikket/env/server", () => ({
  env: envState,
}))

mock.module("@crikket/db", () => ({
  db: {
    query: {
      bugReportStorageCleanup: {
        findMany: async () => [],
        findFirst: async () => null,
      },
    },
    delete: () => ({
      where: async () => undefined,
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: async () => undefined,
      }),
    }),
  },
}))

mock.module("@crikket/db/schema/bug-report", () => ({
  bugReportStorageCleanup: {
    attachmentKey: { __column: "attachmentKey" },
    nextAttemptAt: { __column: "nextAttemptAt" },
  },
}))

mock.module("@crikket/shared/lib/errors", () => ({
  reportNonFatalError: () => undefined,
}))

let extractStorageKeyFromUrl: typeof import("../src/lib/storage").extractStorageKeyFromUrl

beforeAll(async () => {
  ;({ extractStorageKeyFromUrl } = await import("../src/lib/storage"))
})

beforeEach(() => {
  envState.STORAGE_PUBLIC_URL = "https://cdn.example.com/bug-reports"
})

afterAll(() => {
  mock.restore()
})

describe("extractStorageKeyFromUrl", () => {
  it("extracts key from configured public base URL", () => {
    const key = extractStorageKeyFromUrl(
      "https://cdn.example.com/bug-reports/video%2Fclip.webm"
    )

    expect(key).toBe("video/clip.webm")
  })

  it("returns null when URL does not match configured public base URL", () => {
    const key = extractStorageKeyFromUrl("https://evil.example.com/file.webm")

    expect(key).toBeNull()
  })

  it("extracts key from virtual-hosted bucket URL when no public URL is set", () => {
    envState.STORAGE_PUBLIC_URL = undefined

    const key = extractStorageKeyFromUrl(
      "https://bug-report-bucket.s3.us-east-1.amazonaws.com/path/to/file.webm"
    )

    expect(key).toBe("path/to/file.webm")
  })

  it("extracts key from path-style bucket URL when no public URL is set", () => {
    envState.STORAGE_PUBLIC_URL = undefined

    const key = extractStorageKeyFromUrl(
      "https://s3.us-east-1.amazonaws.com/bug-report-bucket/path/to/file.webm"
    )

    expect(key).toBe("path/to/file.webm")
  })

  it("returns null for invalid URLs", () => {
    const key = extractStorageKeyFromUrl("not-a-valid-url")

    expect(key).toBeNull()
  })
})
