ALTER TABLE "rate_limit" DROP CONSTRAINT IF EXISTS "rate_limit_pkey";--> statement-breakpoint
ALTER TABLE "rate_limit" ADD COLUMN "id" text;--> statement-breakpoint
UPDATE "rate_limit" SET "id" = "key" WHERE "id" IS NULL;--> statement-breakpoint
ALTER TABLE "rate_limit" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_key_unique" UNIQUE("key");
