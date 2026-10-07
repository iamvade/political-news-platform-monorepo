CREATE TYPE "public"."media_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "status" "media_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "original_filename" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "processing_error" text;--> statement-breakpoint
CREATE INDEX "media_status_idx" ON "media" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_alt_trgm_idx" ON "media" USING gin ("alt" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "media_credit_trgm_idx" ON "media" USING gin ("credit" gin_trgm_ops);--> statement-breakpoint
-- Backfill (hand-added): media created before the upload pipeline existed are treated as ready.
UPDATE "media" SET "status" = 'ready';
