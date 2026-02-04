ALTER TABLE "bug_report_action" ADD COLUMN "offset" integer;--> statement-breakpoint
ALTER TABLE "bug_report_log" ADD COLUMN "offset" integer;--> statement-breakpoint
ALTER TABLE "bug_report_network_request" ADD COLUMN "offset" integer;