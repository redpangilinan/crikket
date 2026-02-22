CREATE TABLE "bug_report_storage_cleanup" (
	"id" text PRIMARY KEY NOT NULL,
	"attachment_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bug_report_storage_cleanup_attachment_key_unique" UNIQUE("attachment_key")
);
--> statement-breakpoint
CREATE INDEX "bug_report_storage_cleanup_nextAttemptAt_idx" ON "bug_report_storage_cleanup" USING btree ("next_attempt_at");