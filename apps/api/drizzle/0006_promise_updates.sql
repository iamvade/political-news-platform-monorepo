CREATE TABLE "promise_updates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promise_updates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"promise_id" bigint NOT NULL,
	"status" "promise_status" NOT NULL,
	"date" date NOT NULL,
	"note_mn" text NOT NULL,
	"source_url" text NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promise_updates_source_url_http" CHECK ("promise_updates"."source_url" ~ '^https?://')
);
--> statement-breakpoint
ALTER TABLE "promise_updates" ADD CONSTRAINT "promise_updates_promise_id_promises_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_updates" ADD CONSTRAINT "promise_updates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promise_updates_promise_id_date_idx" ON "promise_updates" USING btree ("promise_id","date");--> statement-breakpoint
CREATE INDEX "promise_updates_created_by_idx" ON "promise_updates" USING btree ("created_by");