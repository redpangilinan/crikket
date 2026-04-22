CREATE TABLE "organization_github_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"repo" text NOT NULL,
	"token_encrypted" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_github_integration" ADD CONSTRAINT "organization_github_integration_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_github_integration_organizationId_idx" ON "organization_github_integration" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_github_integration_organizationId_unique" ON "organization_github_integration" USING btree ("organization_id");