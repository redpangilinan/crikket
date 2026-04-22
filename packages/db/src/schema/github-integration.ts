import { relations } from "drizzle-orm"
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { organization } from "./auth"

export const organizationGithubIntegration = pgTable(
  "organization_github_integration",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    repo: text("repo").notNull(),
    tokenEncrypted: text("token_encrypted").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("org_github_integration_organizationId_idx").on(table.organizationId),
    uniqueIndex("org_github_integration_organizationId_unique").on(
      table.organizationId
    ),
  ]
)

export const organizationGithubIntegrationRelations = relations(
  organizationGithubIntegration,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationGithubIntegration.organizationId],
      references: [organization.id],
    }),
  })
)
