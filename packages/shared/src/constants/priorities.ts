export const PRIORITY_OPTIONS = {
  none: "none",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
} as const

export type Priority = (typeof PRIORITY_OPTIONS)[keyof typeof PRIORITY_OPTIONS]
