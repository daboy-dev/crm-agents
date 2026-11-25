CREATE TABLE "pr_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger_sha" text NOT NULL,
	"migration_sha" text,
	"run_id" bigint NOT NULL,
	"run_attempt" integer NOT NULL,
	"run_url" text NOT NULL,
	"conclusion" text NOT NULL,
	"status" text NOT NULL,
	"errors" jsonb,
	"error" text,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pr_checks_run_uq" UNIQUE("run_id","run_attempt")
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "simulate_type_error" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "simulate_max_tokens" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "max_tokens_simulated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "split_task_id" integer;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "split_reason" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "split_from" integer;--> statement-breakpoint
CREATE INDEX "pr_checks_trigger_idx" ON "pr_checks" USING btree ("trigger_sha");