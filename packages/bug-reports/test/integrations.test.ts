import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test"

// ----- Mutable state wired into the module-level mocks below ---------------

type Report = {
  id: string
  organizationId: string
  title: string | null
  description: string | null
  priority: string
  url: string | null
  status: string
  tags: string[] | null
  attachmentType: string | null
  deviceInfo: unknown
  metadata: unknown
  createdAt: Date
  captureKey: string | null
  debuggerKey: string | null
  debuggerContentEncoding: string | null
  logs: Array<{ level: string; message: string; timestamp: Date }>
  networkRequests: Array<{
    method: string
    url: string
    status: number | null
    duration: number | null
    timestamp: Date
  }>
  actions: Array<{ type: string; target: string | null; timestamp: Date }>
}

const state: {
  report: Report | null
  credentials: { repo: string; token: string } | null
  captureBytes: Buffer | null
  debuggerBytes: Buffer | null
  // Fetch-side state
  branchExists: boolean
  branchCreateStatus: number
  existingFileSha: string | undefined
  issueStatus: number
  issueResponse: { number?: number; html_url?: string }
  nonFatalErrors: Array<{ message: string; error: unknown }>
} = {
  report: null,
  credentials: null,
  captureBytes: null,
  debuggerBytes: null,
  branchExists: false,
  branchCreateStatus: 201,
  existingFileSha: undefined,
  issueStatus: 201,
  issueResponse: {
    number: 42,
    html_url: "https://github.com/test/repo/issues/42",
  },
  nonFatalErrors: [],
}

mock.module("@crikket/env/server", () => ({
  env: {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/crikket",
    BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
    BETTER_AUTH_URL: "http://localhost:3000",
    STORAGE_BUCKET: "bug-report-bucket",
    STORAGE_REGION: "us-east-1",
    STORAGE_ENDPOINT: "https://s3.us-east-1.amazonaws.com",
    STORAGE_ACCESS_KEY_ID: "access",
    STORAGE_SECRET_ACCESS_KEY: "secret",
  },
}))

mock.module("@crikket/db", () => ({
  db: {
    query: {
      bugReport: {
        findFirst: () => Promise.resolve(state.report),
      },
      bugReportArtifactCleanup: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
      },
    },
  },
}))

mock.module("@crikket/shared/lib/errors", () => ({
  reportNonFatalError: (message: string, error: unknown) => {
    state.nonFatalErrors.push({ message, error })
  },
}))

mock.module("../src/lib/github-integration-config", () => ({
  getGithubIntegrationCredentials: () => Promise.resolve(state.credentials),
}))

mock.module("../src/lib/storage", () => ({
  getStorageProvider: () => ({
    read: (key: string): Promise<Buffer> => {
      if (state.report?.captureKey && key === state.report.captureKey) {
        return Promise.resolve(state.captureBytes ?? Buffer.alloc(0))
      }
      if (state.report?.debuggerKey && key === state.report.debuggerKey) {
        return Promise.resolve(state.debuggerBytes ?? Buffer.alloc(0))
      }
      return Promise.reject(new Error(`unknown storage key: ${key}`))
    },
  }),
  // Used by signed-url tests; included to keep the module shape complete.
  isExpiringSignedUrl: () => false,
}))

// ----- Fetch mock -----------------------------------------------------------

interface RecordedCall {
  url: string
  method: string
  body?: unknown
}

const fetchCalls: RecordedCall[] = []

const REPO_ROOT_RE = /\/repos\/[^/]+\/[^/]+$/
const NOT_FOUND_RE = /not found/i
const OWNER_REPO_RE = /owner\/repo/i
const ISSUE_CREATE_FAILED_RE = /Failed to create GitHub issue/i

function jsonResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  )
}

const originalFetch = globalThis.fetch
globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
  const u =
    typeof url === "string"
      ? url
      : url instanceof URL
        ? url.toString()
        : url.url
  const method = (init?.method ?? "GET").toUpperCase()
  let body: unknown
  if (init?.body && typeof init.body === "string") {
    try {
      body = JSON.parse(init.body)
    } catch {
      body = init.body
    }
  }
  fetchCalls.push({ url: u, method, body })

  // Branch check
  if (method === "GET" && u.includes("/branches/")) {
    return state.branchExists
      ? jsonResponse(200, { name: "crikket-attachments" })
      : jsonResponse(404, { message: "Branch not found" })
  }
  // Get repo info (for default_branch)
  if (method === "GET" && REPO_ROOT_RE.test(u)) {
    return jsonResponse(200, { default_branch: "main" })
  }
  // Get ref for default branch
  if (method === "GET" && u.includes("/git/ref/heads/")) {
    return jsonResponse(200, { object: { sha: "defaultsha1234" } })
  }
  // Create ref
  if (method === "POST" && u.includes("/git/refs")) {
    return jsonResponse(state.branchCreateStatus, {})
  }
  // Contents GET — existing sha check
  if (method === "GET" && u.includes("/contents/")) {
    if (state.existingFileSha) {
      return jsonResponse(200, { sha: state.existingFileSha })
    }
    return jsonResponse(404, {})
  }
  // Contents PUT — upload
  if (method === "PUT" && u.includes("/contents/")) {
    return jsonResponse(200, {})
  }
  // Create issue
  if (method === "POST" && u.includes("/issues")) {
    return jsonResponse(state.issueStatus, state.issueResponse)
  }
  return Promise.reject(new Error(`Unhandled fetch: ${method} ${u}`))
}) as typeof fetch

afterAll(() => {
  globalThis.fetch = originalFetch
  mock.restore()
})

// ----- Module under test ----------------------------------------------------

let forwardBugReportToGitHub: typeof import("../src/lib/integrations").forwardBugReportToGitHub
let createGitHubIssue: typeof import("../src/lib/integrations").createGitHubIssue
let attachAndUpdateGitHubIssue: typeof import("../src/lib/integrations").attachAndUpdateGitHubIssue

beforeAll(async () => {
  ;({
    forwardBugReportToGitHub,
    createGitHubIssue,
    attachAndUpdateGitHubIssue,
  } = await import("../src/lib/integrations"))
})

// ----- Helpers --------------------------------------------------------------

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "br_abc123",
    organizationId: "org_test",
    title: "Button does not submit",
    description: "Clicking Save does nothing on the settings page.",
    priority: "high",
    url: "https://app.example.com/settings",
    status: "new",
    tags: ["settings", "regression"],
    attachmentType: "screenshot",
    deviceInfo: {
      browser: "Chrome 131",
      os: "macOS",
      viewport: "1440x900",
    },
    metadata: {
      duration: "2s",
      durationMs: 2000,
      sdkVersion: "1.0.0",
      submittedVia: "widget",
    },
    createdAt: new Date("2026-04-22T16:00:00Z"),
    captureKey:
      "organizations/org_test/bug-reports/br_abc123/capture/screenshot.png",
    debuggerKey:
      "organizations/org_test/bug-reports/br_abc123/debugger/payload.json.gz",
    debuggerContentEncoding: null,
    logs: [
      {
        level: "error",
        message: "Uncaught TypeError: cannot read properties of undefined",
        timestamp: new Date("2026-04-22T16:00:01Z"),
      },
      {
        level: "warn",
        message: "Deprecated API usage",
        timestamp: new Date("2026-04-22T16:00:02Z"),
      },
    ],
    networkRequests: [
      {
        method: "POST",
        url: "https://api.example.com/v1/settings",
        status: 500,
        duration: 423,
        timestamp: new Date("2026-04-22T16:00:03Z"),
      },
    ],
    actions: [
      {
        type: "click",
        target: "button#save",
        timestamp: new Date("2026-04-22T16:00:00Z"),
      },
      {
        type: "input",
        target: "input#email",
        timestamp: new Date("2026-04-22T16:00:00.500Z"),
      },
    ],
    ...overrides,
  }
}

function resetState(): void {
  state.report = null
  state.credentials = null
  state.captureBytes = null
  state.debuggerBytes = null
  state.branchExists = false
  state.branchCreateStatus = 201
  state.existingFileSha = undefined
  state.issueStatus = 201
  state.issueResponse = {
    number: 42,
    html_url: "https://github.com/test/repo/issues/42",
  }
  state.nonFatalErrors = []
  fetchCalls.length = 0
}

function lastIssuePost(): RecordedCall | undefined {
  return [...fetchCalls]
    .reverse()
    .find((c) => c.method === "POST" && c.url.endsWith("/issues"))
}

const ISSUE_PATCH_URL_RE = /\/issues\/\d+$/
const ISSUE_42_PATCH_URL_RE = /\/issues\/42$/

// After the create/attach split, attachments + size notices land in a PATCH
// to /issues/<n> (the followup that embeds artifact links), not in the
// initial POST /issues body. Tests asserting on attachment markdown should
// inspect this call instead of lastIssuePost.
function lastIssuePatch(): RecordedCall | undefined {
  return [...fetchCalls]
    .reverse()
    .find((c) => c.method === "PATCH" && ISSUE_PATCH_URL_RE.test(c.url))
}

beforeEach(() => {
  resetState()
})
afterEach(() => {
  resetState()
})

// ----- Tests ----------------------------------------------------------------

describe("forwardBugReportToGitHub: guard rails", () => {
  it("returns early when the report does not exist", async () => {
    state.report = null
    state.credentials = { repo: "owner/repo", token: "ghp_x" }

    await forwardBugReportToGitHub("br_missing")

    // No GitHub calls should fire if the report wasn't found.
    const githubCalls = fetchCalls.filter((c) =>
      c.url.includes("api.github.com")
    )
    expect(githubCalls.length).toBe(0)
    expect(
      state.nonFatalErrors.some((e) => NOT_FOUND_RE.test(e.message))
    ).toBeTrue()
  })

  it("returns early when no credentials are configured for the org", async () => {
    state.report = makeReport({ captureKey: null, debuggerKey: null })
    state.credentials = null

    await forwardBugReportToGitHub(state.report.id)

    const githubCalls = fetchCalls.filter((c) =>
      c.url.includes("api.github.com")
    )
    expect(githubCalls.length).toBe(0)
  })

  it("reports a non-fatal error and returns when repo is malformed", async () => {
    state.report = makeReport({ captureKey: null, debuggerKey: null })
    state.credentials = { repo: "not-a-valid-repo", token: "ghp_x" }

    await forwardBugReportToGitHub(state.report.id)

    const githubCalls = fetchCalls.filter((c) =>
      c.url.includes("api.github.com")
    )
    expect(githubCalls.length).toBe(0)
    expect(
      state.nonFatalErrors.some((e) => OWNER_REPO_RE.test(e.message))
    ).toBeTrue()
  })
})

describe("forwardBugReportToGitHub: issue body rendering", () => {
  beforeEach(() => {
    state.report = makeReport()
    state.credentials = { repo: "owner/repo", token: "ghp_x" }
    state.captureBytes = Buffer.from("fake-png-bytes")
    state.debuggerBytes = Buffer.from(
      JSON.stringify({ actions: [], logs: [], networkRequests: [] })
    )
    state.branchExists = true
  })

  it("builds title, labels, and description from the report", async () => {
    await forwardBugReportToGitHub(state.report!.id)

    const post = lastIssuePost()
    expect(post).toBeDefined()
    const body = post!.body as { title: string; labels: string[]; body: string }

    expect(body.title).toBe("[crikket] Button does not submit")
    expect(body.labels).toEqual(["crikket", "priority:high"])
    expect(body.body).toContain("## Description")
    expect(body.body).toContain("Clicking Save does nothing")
  })

  it("emits the Context table with device, URL, and tag fields", async () => {
    await forwardBugReportToGitHub(state.report!.id)

    const bodyText = (lastIssuePost()!.body as { body: string }).body
    expect(bodyText).toContain("## Context")
    expect(bodyText).toContain("| URL | https://app.example.com/settings |")
    expect(bodyText).toContain("| Browser | Chrome 131 |")
    expect(bodyText).toContain("| OS | macOS |")
    expect(bodyText).toContain("| Priority | high |")
    expect(bodyText).toContain("| Tags | settings, regression |")
  })

  it("renders artifact links using github.com/<repo>/blob URLs and no inline embed", async () => {
    await forwardBugReportToGitHub(state.report!.id)

    // Attachment links land in the PATCH that updates the body after uploads,
    // not in the initial create POST (which goes out before attachments are
    // touched so the issue URL can be returned to the SDK quickly).
    const bodyText = (lastIssuePatch()!.body as { body: string }).body

    // Uses blob URL, not raw.githubusercontent.com
    expect(bodyText).toContain(
      "https://github.com/owner/repo/blob/crikket-attachments/br_abc123/br_abc123.png"
    )
    expect(bodyText).toContain(
      "https://github.com/owner/repo/blob/crikket-attachments/br_abc123/br_abc123.debugger.json"
    )
    expect(bodyText).not.toContain("raw.githubusercontent.com")

    // No inline screenshot embed (Camo would refuse private-repo content).
    expect(bodyText).not.toContain("![Screenshot]")

    // The original POST should NOT contain the artifact links — they only
    // appear after the upload phase finishes and PATCHes the body.
    const initialBody = (lastIssuePost()!.body as { body: string }).body
    expect(initialBody).not.toContain("/blob/crikket-attachments/")
  })

  it("renders reproduction steps, console logs, and a network table", async () => {
    await forwardBugReportToGitHub(state.report!.id)

    const bodyText = (lastIssuePost()!.body as { body: string }).body
    expect(bodyText).toContain("## Reproduction steps")
    expect(bodyText).toContain("1. **click** — `button#save`")
    expect(bodyText).toContain("2. **input**")

    expect(bodyText).toContain("## Console logs")
    expect(bodyText).toContain("ERROR: Uncaught TypeError")

    expect(bodyText).toContain("<summary>Network requests</summary>")
    expect(bodyText).toContain("| POST | 500 | 423ms |")
  })

  it("omits the priority label when priority is 'none'", async () => {
    state.report = makeReport({ priority: "none" })

    await forwardBugReportToGitHub(state.report.id)

    const labels = (lastIssuePost()!.body as { labels: string[] }).labels
    expect(labels).toEqual(["crikket"])
  })

  it("falls back to the URL in the title when description has no title", async () => {
    state.report = makeReport({ title: null })

    await forwardBugReportToGitHub(state.report.id)

    const title = (lastIssuePost()!.body as { title: string }).title
    expect(title).toBe(
      "[crikket] Bug report from https://app.example.com/settings"
    )
  })
})

describe("forwardBugReportToGitHub: attachment branch + upload flow", () => {
  beforeEach(() => {
    state.report = makeReport()
    state.credentials = { repo: "owner/repo", token: "ghp_x" }
    state.captureBytes = Buffer.from("fake-png")
    state.debuggerBytes = Buffer.from("{}")
  })

  it("creates the attachments branch when it does not exist", async () => {
    state.branchExists = false

    await forwardBugReportToGitHub(state.report!.id)

    // Should have fetched repo info, default ref, and POSTed to /git/refs.
    const createRef = fetchCalls.find(
      (c) => c.method === "POST" && c.url.endsWith("/git/refs")
    )
    expect(createRef).toBeDefined()
    const body = createRef!.body as { ref: string; sha: string }
    expect(body.ref).toBe("refs/heads/crikket-attachments")
    expect(body.sha).toBe("defaultsha1234")
  })

  it("is idempotent when branch creation returns 422 (race condition)", async () => {
    state.branchExists = false
    state.branchCreateStatus = 422

    await forwardBugReportToGitHub(state.report!.id)

    // Issue is still created despite the 422 on the ref create.
    const post = lastIssuePost()
    expect(post).toBeDefined()
  })

  it("skips branch creation when the branch already exists", async () => {
    state.branchExists = true

    await forwardBugReportToGitHub(state.report!.id)

    const createRef = fetchCalls.find(
      (c) => c.method === "POST" && c.url.endsWith("/git/refs")
    )
    expect(createRef).toBeUndefined()
  })

  it("includes the existing file sha when overwriting an uploaded artifact", async () => {
    state.branchExists = true
    state.existingFileSha = "existing-blob-sha"

    await forwardBugReportToGitHub(state.report!.id)

    const puts = fetchCalls.filter((c) => c.method === "PUT")
    expect(puts.length).toBe(2) // capture + debugger
    for (const put of puts) {
      const body = put.body as { sha?: string; content: string; branch: string }
      expect(body.sha).toBe("existing-blob-sha")
      expect(body.branch).toBe("crikket-attachments")
      // Content is base64-encoded.
      expect(() => Buffer.from(body.content, "base64")).not.toThrow()
    }
  })

  it("omits the sha when no existing file is present (create)", async () => {
    state.branchExists = true
    state.existingFileSha = undefined

    await forwardBugReportToGitHub(state.report!.id)

    const puts = fetchCalls.filter((c) => c.method === "PUT")
    for (const put of puts) {
      const body = put.body as { sha?: string }
      expect(body.sha).toBeUndefined()
    }
  })

  it("skips upload for oversize artifacts and renders a size notice", async () => {
    state.branchExists = true
    state.captureBytes = Buffer.alloc(41 * 1024 * 1024) // 41 MB > 40 MB cap
    state.debuggerBytes = Buffer.from("{}")

    await forwardBugReportToGitHub(state.report!.id)

    // No PUT for the oversize capture.
    const capturePuts = fetchCalls.filter(
      (c) => c.method === "PUT" && c.url.includes("br_abc123.png")
    )
    expect(capturePuts.length).toBe(0)

    // The "not uploaded" notice is part of the attachments section, which
    // only gets rendered into the PATCH body — the initial create POST goes
    // out before attachments are processed.
    const bodyText = (lastIssuePatch()!.body as { body: string }).body
    expect(bodyText).toContain("not uploaded")
    expect(bodyText).toContain("MB exceeds")
    expect(bodyText).toContain("Retrieve from crikket")
  })
})

describe("forwardBugReportToGitHub: issue creation failure", () => {
  it("reports a non-fatal error and does not throw when POST /issues fails", async () => {
    state.report = makeReport({ captureKey: null, debuggerKey: null })
    state.credentials = { repo: "owner/repo", token: "ghp_x" }
    state.branchExists = true
    state.issueStatus = 500
    state.issueResponse = { number: undefined, html_url: undefined }

    await forwardBugReportToGitHub(state.report!.id)

    expect(
      state.nonFatalErrors.some((e) => ISSUE_CREATE_FAILED_RE.test(e.message))
    ).toBeTrue()
  })
})

// The two-phase split exists so upload-session can await issue creation
// (fast) and surface the URL synchronously, while the slow attachment
// uploads + body PATCH stay fire-and-forget. These tests pin that contract.
describe("createGitHubIssue / attachAndUpdateGitHubIssue split", () => {
  beforeEach(() => {
    state.report = makeReport()
    state.credentials = { repo: "owner/repo", token: "ghp_x" }
  })

  it("createGitHubIssue returns the issue URL + number without uploading attachments", async () => {
    const created = await createGitHubIssue(state.report!.id)

    expect(created).not.toBeNull()
    expect(created!.htmlUrl).toBe("https://github.com/test/repo/issues/42")
    expect(created!.number).toBe(42)

    // No attachment uploads should have happened — the contract is "fast,
    // single POST". Branch ensure + Contents API PUTs belong to the second
    // phase.
    const attachmentWrites = fetchCalls.filter(
      (c) => c.method === "PUT" && c.url.includes("/contents/")
    )
    expect(attachmentWrites.length).toBe(0)

    // Initial body has no attachment markdown.
    const initialBody = (lastIssuePost()!.body as { body: string }).body
    expect(initialBody).not.toContain("/blob/crikket-attachments/")
    expect(initialBody).not.toContain("## Artifacts")
  })

  it("createGitHubIssue returns null when the org has no GitHub integration", async () => {
    state.credentials = null

    const created = await createGitHubIssue(state.report!.id)

    expect(created).toBeNull()
    // No POST /issues either — we bail before hitting the API.
    expect(lastIssuePost()).toBeUndefined()
  })

  it("attachAndUpdateGitHubIssue uploads attachments and PATCHes the issue body", async () => {
    state.branchExists = true

    await attachAndUpdateGitHubIssue({
      bugReportId: state.report!.id,
      issueNumber: 42,
      repo: "owner/repo",
      token: "ghp_x",
    })

    const patchedBody = (lastIssuePatch()!.body as { body: string }).body
    expect(patchedBody).toContain("## Artifacts")
    expect(patchedBody).toContain("/blob/crikket-attachments/")
    expect(lastIssuePatch()!.url).toMatch(ISSUE_42_PATCH_URL_RE)
  })
})
