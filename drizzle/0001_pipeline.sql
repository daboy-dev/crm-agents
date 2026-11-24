CREATE TABLE "github_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"event" text NOT NULL,
	"action" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "github_events_delivery_id_unique" UNIQUE("delivery_id")
);
--> statement-breakpoint
CREATE TABLE "previews" (
	"sha" text PRIMARY KEY NOT NULL,
	"pr_number" integer,
	"pr_title" text,
	"branch" text,
	"pr_state" text,
	"pr_updated_at" timestamp with time zone,
	"preview_url" text,
	"deploy_state" text,
	"deploy_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"page" text NOT NULL,
	"width" integer NOT NULL,
	"pathname" text NOT NULL,
	"size" integer NOT NULL,
	CONSTRAINT "screenshots_uq" UNIQUE("report_id","page","width")
);
--> statement-breakpoint
CREATE TABLE "test_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"sha" text NOT NULL,
	"run_id" bigint NOT NULL,
	"run_attempt" integer NOT NULL,
	"run_url" text NOT NULL,
	"conclusion" text NOT NULL,
	"status" text NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"flaky" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"failures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "test_reports_run_uq" UNIQUE("run_id","run_attempt")
);
--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_report_id_test_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."test_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_events_pending_idx" ON "github_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "previews_pr_number_idx" ON "previews" USING btree ("pr_number");--> statement-breakpoint
CREATE INDEX "test_reports_sha_idx" ON "test_reports" USING btree ("sha");