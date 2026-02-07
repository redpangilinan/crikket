import { relations } from "drizzle-orm"
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { organization, user } from "./auth"

export const bugReport = pgTable(
  "bug_report",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id").references(() => user.id, {
      onDelete: "set null",
    }),
    title: text("title"),
    description: text("description"),
    status: text("status").default("open").notNull(), // open, in_progress, resolved, closed
    priority: text("priority").default("medium").notNull(), // low, medium, high, critical
    tags: text("tags").array(), // optional tags for categorization
    url: text("url"),
    attachmentUrl: text("attachment_url"), // video or screenshot URL
    attachmentKey: text("attachment_key"), // storage key/filename for delete operations
    attachmentType: text("attachment_type"), // "video" or "screenshot"
    visibility: text("visibility").default("private").notNull(), // public | private
    metadata: jsonb("metadata"),
    deviceInfo: jsonb("device_info"), // browser, os, viewport, etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bug_report_organizationId_idx").on(table.organizationId),
    index("bug_report_reporterId_idx").on(table.reporterId),
  ]
)

export const bugReportLog = pgTable(
  "bug_report_log",
  {
    id: text("id").primaryKey(),
    bugReportId: text("bug_report_id")
      .notNull()
      .references(() => bugReport.id, { onDelete: "cascade" }),
    level: text("level").notNull(), // info, warn, error, debug
    message: text("message").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    offset: integer("offset"), // ms from start of recording
    metadata: jsonb("metadata"), // Any extra info or stack trace
  },
  (table) => [index("bug_report_log_bugReportId_idx").on(table.bugReportId)]
)

export const bugReportNetworkRequest = pgTable(
  "bug_report_network_request",
  {
    id: text("id").primaryKey(),
    bugReportId: text("bug_report_id")
      .notNull()
      .references(() => bugReport.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    url: text("url").notNull(),
    status: integer("status"),
    duration: integer("duration"), // in ms
    requestHeaders: jsonb("request_headers"),
    responseHeaders: jsonb("response_headers"),
    requestBody: text("request_body"),
    responseBody: text("response_body"),
    timestamp: timestamp("timestamp").notNull(),
    offset: integer("offset"), // ms from start of recording
  },
  (table) => [
    index("bug_report_network_request_bugReportId_idx").on(table.bugReportId),
  ]
)

export const bugReportAction = pgTable(
  "bug_report_action",
  {
    id: text("id").primaryKey(),
    bugReportId: text("bug_report_id")
      .notNull()
      .references(() => bugReport.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // click, input, navigation, etc.
    target: text("target"), // selector or element description
    timestamp: timestamp("timestamp").notNull(),
    offset: integer("offset"), // ms from start of recording
    metadata: jsonb("metadata"), // coordinates, key pressed, etc.
  },
  (table) => [index("bug_report_action_bugReportId_idx").on(table.bugReportId)]
)

export const bugReportRelations = relations(bugReport, ({ one, many }) => ({
  organization: one(organization, {
    fields: [bugReport.organizationId],
    references: [organization.id],
  }),
  reporter: one(user, {
    fields: [bugReport.reporterId],
    references: [user.id],
  }),
  logs: many(bugReportLog),
  networkRequests: many(bugReportNetworkRequest),
  actions: many(bugReportAction),
}))

export const bugReportLogRelations = relations(bugReportLog, ({ one }) => ({
  bugReport: one(bugReport, {
    fields: [bugReportLog.bugReportId],
    references: [bugReport.id],
  }),
}))

export const bugReportNetworkRequestRelations = relations(
  bugReportNetworkRequest,
  ({ one }) => ({
    bugReport: one(bugReport, {
      fields: [bugReportNetworkRequest.bugReportId],
      references: [bugReport.id],
    }),
  })
)

export const bugReportActionRelations = relations(
  bugReportAction,
  ({ one }) => ({
    bugReport: one(bugReport, {
      fields: [bugReportAction.bugReportId],
      references: [bugReport.id],
    }),
  })
)
