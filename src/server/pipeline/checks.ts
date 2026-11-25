import { unzipSync } from "fflate";
import { z } from "zod";
import type { Db } from "@/server/db/client";
import { prChecks, type CheckErrors } from "@/server/db/schema";
import { downloadArtifact, findRunArtifact } from "@/server/github/client";
import { PR_CHECK_ARTIFACT_NAME } from "@/server/github/config";
import type { PreviewRun } from "./classify";

/**
 * check.json of crm-demo's pr-check.yml (D31, D33). It is written by a job
 * that runs the branch's code, so only GitHub's run data is trusted: the
 * shas are checked against it, and the migration commit is checked against
 * the branch before the run adopts it (engine).
 */

const sha = z.string().regex(/^[0-9a-f]{40}$/);
const step = z.object({ ok: z.boolean(), output: z.string().nullable() });

const checkSchema = z.object({
  sha,
  trigger_sha: sha,
  migration_sha: sha.nullable(),
  ok: z.boolean(),
  migrate: step,
  typecheck: step,
  lint: step,
  run_id: z.number().int(),
  run_attempt: z.number().int(),
});
export type CheckJson = z.infer<typeof checkSchema>;

/** At most this much of each tool's output goes to Develop. */
const MAX_OUTPUT = 8_000;

export const parseCheck = (json: unknown): CheckJson => checkSchema.parse(json);

/** Reads check.json from the pr-check zip; nothing else in it is read. */
export function readCheckZip(zip: Uint8Array): CheckJson {
  const files = unzipSync(zip, {
    filter: (f) => f.name === "check.json" && f.originalSize < 1024 * 1024,
  });
  const file = files["check.json"];
  if (!file) throw new Error("check.json missing from the artifact");
  return parseCheck(JSON.parse(new TextDecoder().decode(file)));
}

const trim = (s: CheckJson["migrate"]) =>
  s.ok ? null : (s.output ?? "").slice(0, MAX_OUTPUT) || "(sin salida)";

export function checkErrors(check: CheckJson): CheckErrors {
  return {
    migrate: trim(check.migrate),
    typecheck: trim(check.typecheck),
    lint: trim(check.lint),
  };
}

/** The errors as Develop reads them in its next iteration (D33). */
export function checkFeedback(errors: CheckErrors | null): string {
  const parts = ["La comprobación del PR (pr-check) ha fallado."];
  if (!errors) {
    parts.push("No dejó check.json: el workflow falló antes de comprobar.");
    return parts.join("\n");
  }
  if (errors.migrate) {
    parts.push(
      "",
      "### drizzle-kit generate",
      "Solo se admiten cambios de esquema que añaden; no renombres ni borres columnas.",
      errors.migrate,
    );
  }
  if (errors.typecheck) parts.push("", "### tsc --noEmit", errors.typecheck);
  if (errors.lint) parts.push("", "### ESLint", errors.lint);
  return parts.join("\n");
}

type CheckValues = {
  status: "passed" | "failed" | "error";
  migrationSha?: string | null;
  errors?: CheckErrors | null;
  error?: string | null;
};

async function saveCheck(db: Db, run: PreviewRun, values: CheckValues) {
  const row = {
    triggerSha: run.sha,
    runId: run.runId,
    runAttempt: run.runAttempt,
    runUrl: run.runUrl,
    conclusion: run.conclusion,
    completedAt: run.completedAt,
    migrationSha: null,
    errors: null,
    error: null,
    ...values,
  };
  await db
    .insert(prChecks)
    .values(row)
    .onConflictDoUpdate({
      target: [prChecks.runId, prChecks.runAttempt],
      set: row,
    });
}

/**
 * Handles a completed pr-check.yml run: downloads check.json with the PAT
 * and upserts its result. Idempotent per run attempt.
 */
export async function handlePrCheck(db: Db, run: PreviewRun) {
  const artifact = await findRunArtifact(run.runId, PR_CHECK_ARTIFACT_NAME);
  if (!artifact) {
    // generate failed (install, timeout) or the commit could not be pushed.
    await saveCheck(db, run, {
      status: "error",
      error: `Artifact ${PR_CHECK_ARTIFACT_NAME} not found (${run.conclusion})`,
    });
    return;
  }
  let check: CheckJson;
  try {
    check = readCheckZip(await downloadArtifact(artifact));
  } catch (error) {
    await saveCheck(db, run, {
      status: "error",
      error: `check.json no válido: ${(error as Error).message}`.slice(0, 1000),
    });
    return;
  }
  if (check.trigger_sha !== run.sha || check.run_id !== run.runId) {
    await saveCheck(db, run, {
      status: "error",
      error: "check.json does not match the workflow run",
    });
    return;
  }
  await saveCheck(db, run, {
    status: check.ok ? "passed" : "failed",
    migrationSha: check.migration_sha,
    errors: check.ok ? null : checkErrors(check),
  });
}
