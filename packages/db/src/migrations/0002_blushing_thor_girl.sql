CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bug_report" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "capture_public_key" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_organization_id_idx" ON "project" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD CONSTRAINT "bug_report_upload_session_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_public_key" ADD CONSTRAINT "capture_public_key_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_report_projectId_idx" ON "bug_report" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "bug_report_upload_session_projectId_idx" ON "bug_report_upload_session" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "capture_public_key_projectId_idx" ON "capture_public_key" USING btree ("project_id");
--> statement-breakpoint
INSERT INTO "project" ("id", "organization_id", "name")
SELECT
  'default_' || "id",
  "id",
  'Default Project'
FROM "organization";

--> statement-breakpoint
UPDATE "bug_report"
SET "project_id" = 'default_' || "organization_id"
WHERE "project_id" IS NULL;

--> statement-breakpoint
UPDATE "bug_report_upload_session"
SET "project_id" = 'default_' || "organization_id"
WHERE "project_id" IS NULL;

--> statement-breakpoint
UPDATE "capture_public_key"
SET "project_id" = 'default_' || "organization_id"
WHERE "project_id" IS NULL;