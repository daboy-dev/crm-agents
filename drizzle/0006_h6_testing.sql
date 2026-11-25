ALTER TABLE "agent_steps" DROP CONSTRAINT "agent_steps_uq";--> statement-breakpoint
ALTER TABLE "agent_steps" ADD COLUMN "scope" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "simulate_criterion_fail" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "simulate_persistent_fail" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "test_reports" ADD COLUMN "criteria" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_uq" UNIQUE NULLS NOT DISTINCT("run_id","task_id","iteration","agent","scope");