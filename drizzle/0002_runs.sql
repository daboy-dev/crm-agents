CREATE TABLE "agent_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"task_id" integer,
	"iteration" integer NOT NULL,
	"agent" text NOT NULL,
	"output" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_steps_uq" UNIQUE NULLS NOT DISTINCT("run_id","task_id","iteration","agent")
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"run_version" integer NOT NULL,
	"actor" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"request" text NOT NULL,
	"provider" text NOT NULL,
	"scenario" text,
	"simulate_crash" boolean DEFAULT false NOT NULL,
	"crashed_at" timestamp with time zone,
	"status" text DEFAULT 'queued' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_from" text,
	"blocked_reason" text,
	"plan_revision" integer DEFAULT 1 NOT NULL,
	"feedback" text,
	"plan_summary" text,
	"head_sha" text,
	"target_sha" text,
	"target_commits" jsonb,
	"pr_number" integer,
	"pr_url" text,
	"cleanup_pending" boolean DEFAULT false NOT NULL,
	"llm_calls" integer DEFAULT 0 NOT NULL,
	"step_attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"plan_revision" integer NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"acceptance_criteria" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"iteration" integer DEFAULT 0 NOT NULL,
	"max_iterations" integer DEFAULT 3 NOT NULL,
	"last_feedback" text,
	"commit_sha" text,
	CONSTRAINT "tasks_uq" UNIQUE("run_id","plan_revision","position")
);
--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_events_run_idx" ON "run_events" USING btree ("run_id","id");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_head_sha_idx" ON "runs" USING btree ("head_sha");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_one_active_uq" ON "runs" USING btree ((true)) WHERE "runs"."status" not in ('queued', 'done', 'rejected', 'cancelled', 'failed');