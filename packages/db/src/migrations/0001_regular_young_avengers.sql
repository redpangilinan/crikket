ALTER TABLE "bug_report" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_report_assigneeId_idx" ON "bug_report" USING btree ("assignee_id");