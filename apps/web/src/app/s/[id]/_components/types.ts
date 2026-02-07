export type OrpcClient = typeof import("@/utils/orpc").client
export type SharedBugReport = Awaited<
  ReturnType<OrpcClient["bugReport"]["getById"]>
>

export type SharedBugReportDebugger = NonNullable<SharedBugReport["debugger"]>

export type DebuggerTimelineKind = "action" | "log" | "network"

export interface DebuggerTimelineEntry {
  id: string
  kind: DebuggerTimelineKind
  label: string
  detail: string
  timestamp: string
  offset: number | null
}

export interface DeviceInfo {
  browser?: string
  os?: string
  viewport?: string
}
