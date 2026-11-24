ALTER TABLE "agent_steps" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD COLUMN "calls" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "providers" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "simulate_plan_crash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "plan_crashed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "plan_assumptions" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "rejected_reason" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "base_sha" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "context_paths" jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "files" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- H3 criteria were plain strings: turn them into { id, type, text } (D28).
UPDATE "tasks" SET "acceptance_criteria" = (
  SELECT coalesce(jsonb_agg(
    jsonb_build_object('id', 'c' || c.ord, 'type', 'e2e', 'text', c.value #>> '{}')
    ORDER BY c.ord), '[]'::jsonb)
  FROM jsonb_array_elements("acceptance_criteria") WITH ORDINALITY AS c(value, ord)
) WHERE jsonb_typeof("acceptance_criteria" -> 0) = 'string';--> statement-breakpoint
UPDATE "runs" SET "providers" = jsonb_build_object('orchestrator', "provider", 'develop', "provider", 'testing', "provider") WHERE "providers" IS NULL;
