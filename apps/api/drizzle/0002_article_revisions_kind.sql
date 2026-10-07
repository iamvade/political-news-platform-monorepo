CREATE TYPE "public"."revision_kind" AS ENUM('create', 'update', 'restore', 'submit', 'return_to_draft', 'publish', 'schedule', 'unpublish');--> statement-breakpoint
ALTER TABLE "article_revisions" ADD COLUMN "kind" "revision_kind" DEFAULT 'update' NOT NULL;--> statement-breakpoint
CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "articles_title_trgm_idx" ON "articles" USING gin ("title" gin_trgm_ops);