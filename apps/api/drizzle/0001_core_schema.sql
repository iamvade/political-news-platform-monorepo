CREATE TYPE "public"."article_status" AS ENUM('draft', 'in_review', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."correction_entity_type" AS ENUM('article', 'person', 'organization', 'position', 'bill', 'vote', 'statement', 'promise', 'declaration');--> statement-breakpoint
CREATE TYPE "public"."bill_initiator" AS ENUM('government', 'mps', 'president');--> statement-breakpoint
CREATE TYPE "public"."bill_stage" AS ENUM('submitted', 'consideration', 'first_reading', 'final_reading', 'passed', 'rejected', 'withdrawn', 'vetoed', 'veto_overridden');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('submitted', 'in_committee', 'in_plenary', 'passed', 'rejected', 'withdrawn', 'vetoed');--> statement-breakpoint
CREATE TYPE "public"."sponsor_role" AS ENUM('initiator', 'co_sponsor');--> statement-breakpoint
CREATE TYPE "public"."vote_value" AS ENUM('yes', 'no', 'abstain', 'absent');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('party', 'committee', 'ministry', 'agency', 'constituency', 'parliament');--> statement-breakpoint
CREATE TYPE "public"."promise_status" AS ENUM('kept', 'in_progress', 'broken', 'not_rated');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor', 'reporter', 'data_editor');--> statement-breakpoint
CREATE TABLE "article_bills" (
	"article_id" bigint NOT NULL,
	"bill_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_bills_article_id_bill_id_pk" PRIMARY KEY("article_id","bill_id")
);
--> statement-breakpoint
CREATE TABLE "article_organizations" (
	"article_id" bigint NOT NULL,
	"organization_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_organizations_article_id_organization_id_pk" PRIMARY KEY("article_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "article_persons" (
	"article_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_persons_article_id_person_id_pk" PRIMARY KEY("article_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "article_revisions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "article_revisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"article_id" bigint NOT NULL,
	"snapshot" jsonb NOT NULL,
	"editor_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_tags" (
	"article_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_tags_article_id_tag_id_pk" PRIMARY KEY("article_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"lede" text,
	"body_json" jsonb NOT NULL,
	"body_html" text NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"author_id" bigint NOT NULL,
	"cover_media_id" bigint,
	"category_id" bigint,
	"is_breaking" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "articles_scheduled_has_time" CHECK ("articles"."status" <> 'scheduled' or "articles"."scheduled_at" is not null),
	CONSTRAINT "articles_published_has_time" CHECK ("articles"."status" <> 'published' or "articles"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "corrections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_type" "correction_entity_type" NOT NULL,
	"entity_id" bigint NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_sponsors" (
	"bill_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"role" "sponsor_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_sponsors_bill_id_person_id_pk" PRIMARY KEY("bill_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "bill_stages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bill_stages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bill_id" bigint NOT NULL,
	"stage" "bill_stage" NOT NULL,
	"date" date NOT NULL,
	"note_mn" text,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_stages_source_url_http" CHECK ("bill_stages"."source_url" ~ '^https?://')
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title_mn" text NOT NULL,
	"title_en" text,
	"registration_number" text,
	"initiator_type" "bill_initiator" NOT NULL,
	"status" "bill_status" NOT NULL,
	"submitted_on" date,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_source_url_http" CHECK ("bills"."source_url" ~ '^https?://')
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "votes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bill_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"value" "vote_value" NOT NULL,
	"date" date NOT NULL,
	"motion" text NOT NULL,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_source_url_http" CHECK ("votes"."source_url" ~ '^https?://')
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"r2_key" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"byte_size" integer,
	"alt" text,
	"credit" text,
	"variants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"uploaded_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "organizations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"type" "organization_type" NOT NULL,
	"slug" text NOT NULL,
	"name_mn" text NOT NULL,
	"name_en" text,
	"short_name_mn" text,
	"parent_id" bigint,
	"color" text,
	"logo_media_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "persons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"given_name_mn" text NOT NULL,
	"patronymic_mn" text NOT NULL,
	"given_name_en" text,
	"patronymic_en" text,
	"birth_date" date,
	"gender" text,
	"photo_media_id" bigint,
	"bio_mn" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "positions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"person_id" bigint NOT NULL,
	"organization_id" bigint NOT NULL,
	"title_mn" text NOT NULL,
	"title_en" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_dates_ordered" CHECK ("positions"."end_date" is null or "positions"."end_date" >= "positions"."start_date"),
	CONSTRAINT "positions_source_url_http" CHECK ("positions"."source_url" ~ '^https?://')
);
--> statement-breakpoint
CREATE TABLE "declarations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "declarations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"person_id" bigint NOT NULL,
	"year" integer NOT NULL,
	"filed_on" date,
	"income" numeric(18, 2),
	"assets" numeric(18, 2),
	"liabilities" numeric(18, 2),
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "declarations_source_url_http" CHECK ("declarations"."source_url" ~ '^https?://')
);
--> statement-breakpoint
CREATE TABLE "promises" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promises_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"person_id" bigint,
	"organization_id" bigint,
	"text_mn" text NOT NULL,
	"made_on" date NOT NULL,
	"status" "promise_status" DEFAULT 'not_rated' NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promises_one_subject" CHECK (num_nonnulls("promises"."person_id", "promises"."organization_id") = 1),
	CONSTRAINT "promises_source_url_http" CHECK ("promises"."source_url" ~ '^https?://')
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "statements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"person_id" bigint NOT NULL,
	"quote_mn" text NOT NULL,
	"context_mn" text,
	"said_on" date NOT NULL,
	"article_id" bigint,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statements_source_url_http" CHECK ("statements"."source_url" ~ '^https?://')
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name_mn" text NOT NULL,
	"name_en" text,
	"parent_id" bigint,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name_mn" text NOT NULL,
	"name_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"password_hash" text,
	"role" "user_role" NOT NULL,
	"display_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_bills" ADD CONSTRAINT "article_bills_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_bills" ADD CONSTRAINT "article_bills_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_organizations" ADD CONSTRAINT "article_organizations_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_organizations" ADD CONSTRAINT "article_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_persons" ADD CONSTRAINT "article_persons_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_persons" ADD CONSTRAINT "article_persons_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_stages" ADD CONSTRAINT "bill_stages_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_id_organizations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_logo_media_id_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_photo_media_id_media_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "declarations" ADD CONSTRAINT "declarations_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises" ADD CONSTRAINT "promises_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises" ADD CONSTRAINT "promises_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_bills_bill_id_idx" ON "article_bills" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "article_organizations_organization_id_idx" ON "article_organizations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "article_persons_person_id_idx" ON "article_persons" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "article_revisions_article_id_created_at_idx" ON "article_revisions" USING btree ("article_id","created_at");--> statement-breakpoint
CREATE INDEX "article_revisions_editor_id_idx" ON "article_revisions" USING btree ("editor_id");--> statement-breakpoint
CREATE INDEX "article_tags_tag_id_idx" ON "article_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_slug_unique" ON "articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "articles_status_published_at_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "articles_scheduled_at_idx" ON "articles" USING btree ("scheduled_at") WHERE "articles"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX "articles_author_id_idx" ON "articles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "articles_cover_media_id_idx" ON "articles" USING btree ("cover_media_id");--> statement-breakpoint
CREATE INDEX "articles_category_id_idx" ON "articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "corrections_entity_idx" ON "corrections" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "corrections_date_idx" ON "corrections" USING btree ("date");--> statement-breakpoint
CREATE INDEX "corrections_created_by_idx" ON "corrections" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "bill_sponsors_person_id_idx" ON "bill_sponsors" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "bill_stages_bill_id_date_idx" ON "bill_stages" USING btree ("bill_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_slug_unique" ON "bills" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_bill_person_date_motion_unique" ON "votes" USING btree ("bill_id","person_id","date","motion");--> statement-breakpoint
CREATE INDEX "votes_person_id_idx" ON "votes" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_r2_key_unique" ON "media" USING btree ("r2_key");--> statement-breakpoint
CREATE INDEX "media_uploaded_by_idx" ON "media" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_type_idx" ON "organizations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "organizations_parent_id_idx" ON "organizations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "organizations_logo_media_id_idx" ON "organizations" USING btree ("logo_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_slug_unique" ON "persons" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "persons_photo_media_id_idx" ON "persons" USING btree ("photo_media_id");--> statement-breakpoint
CREATE INDEX "positions_person_id_idx" ON "positions" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "positions_organization_id_end_date_idx" ON "positions" USING btree ("organization_id","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "declarations_person_id_year_unique" ON "declarations" USING btree ("person_id","year");--> statement-breakpoint
CREATE INDEX "promises_person_id_idx" ON "promises" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "promises_organization_id_idx" ON "promises" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "promises_status_idx" ON "promises" USING btree ("status");--> statement-breakpoint
CREATE INDEX "statements_person_id_said_on_idx" ON "statements" USING btree ("person_id","said_on");--> statement-breakpoint
CREATE INDEX "statements_article_id_idx" ON "statements" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_unique" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));