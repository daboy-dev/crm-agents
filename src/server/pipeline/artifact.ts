import { unzipSync } from "fflate";
import { z } from "zod";
import type { TestFailure } from "@/server/db/schema";

/** meta.json written by preview-e2e.yml. */
const metaSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  ref: z.string(),
  target_url: z.string(),
  run_id: z.number().int(),
  run_attempt: z.number().int(),
});
export type E2eMeta = z.infer<typeof metaSchema>;

export function parseMeta(json: unknown): E2eMeta {
  return metaSchema.parse(json);
}

// Subset of Playwright's JSON reporter output that the panel reads.
const resultSchema = z.object({
  status: z.string(),
  errors: z.array(z.object({ message: z.string().optional() })).default([]),
});
const testSchema = z.object({
  projectName: z.string(),
  status: z.enum(["expected", "unexpected", "flaky", "skipped"]),
  results: z.array(resultSchema).default([]),
});
const specSchema = z.object({
  title: z.string(),
  tests: z.array(testSchema),
});
type Suite = {
  title: string;
  specs?: z.infer<typeof specSchema>[];
  suites?: Suite[];
};
const suiteSchema: z.ZodType<Suite> = z.lazy(() =>
  z.object({
    title: z.string(),
    specs: z.array(specSchema).optional(),
    suites: z.array(suiteSchema).optional(),
  }),
);
const reportSchema = z.object({
  suites: z.array(suiteSchema),
  errors: z.array(z.object({ message: z.string().optional() })).default([]),
  stats: z.object({ duration: z.number() }),
});

export type TestSummary = {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
  failures: TestFailure[];
};

const MAX_ERROR_LENGTH = 500;

/** Strips ANSI colours and keeps the start of the message. */
export function cleanError(message: string | undefined): string {
  return (message ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .trim()
    .slice(0, MAX_ERROR_LENGTH);
}

/** Counts results and collects the failing tests from Playwright's JSON report. */
export function parseResults(json: unknown): TestSummary {
  const report = reportSchema.parse(json);
  const summary: TestSummary = {
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    durationMs: Math.round(report.stats.duration),
    failures: [],
  };

  const walk = (suite: Suite, path: string[]) => {
    const here = suite.title ? [...path, suite.title] : path;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        if (test.status === "expected") summary.passed++;
        else if (test.status === "flaky") summary.flaky++;
        else if (test.status === "skipped") summary.skipped++;
        else {
          summary.failed++;
          const last = test.results.at(-1);
          summary.failures.push({
            title: [...here, spec.title].join(" › "),
            project: test.projectName,
            error: cleanError(last?.errors[0]?.message),
          });
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites) walk(suite, []);

  // Errors outside tests (a broken spec file, a global setup failure).
  for (const error of report.errors) {
    summary.failed++;
    summary.failures.push({
      title: "Error fuera de los tests",
      project: "",
      error: cleanError(error.message),
    });
  }
  return summary;
}

export type Screenshot = { page: string; width: number; data: Uint8Array };

export type E2eArtifact = {
  meta: E2eMeta;
  results: TestSummary;
  screenshots: Screenshot[];
};

const SCREENSHOT_PATH = /^screenshots\/([a-z0-9-]{1,60})-(1280|390)\.jpg$/;
const MAX_SCREENSHOTS = 40;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Reads the e2e-results zip in memory. Only meta.json, results.json and
 * screenshots named `<page>-<1280|390>.jpg` are extracted; anything else in
 * the artifact is ignored.
 */
export function readArtifactZip(zip: Uint8Array): E2eArtifact {
  let shots = 0;
  const files = unzipSync(zip, {
    filter: (file) => {
      if (file.originalSize > MAX_FILE_BYTES) return false;
      if (file.name === "meta.json" || file.name === "results.json") {
        return true;
      }
      return SCREENSHOT_PATH.test(file.name) && ++shots <= MAX_SCREENSHOTS;
    },
  });

  const json = (name: string): unknown => {
    const file = files[name];
    if (!file) throw new Error(`${name} missing from the artifact`);
    return JSON.parse(new TextDecoder().decode(file));
  };

  const screenshots: Screenshot[] = [];
  for (const [name, data] of Object.entries(files)) {
    const match = SCREENSHOT_PATH.exec(name);
    if (match?.[1] && match[2]) {
      screenshots.push({ page: match[1], width: Number(match[2]), data });
    }
  }
  screenshots.sort((a, b) => a.page.localeCompare(b.page) || b.width - a.width);

  return {
    meta: parseMeta(json("meta.json")),
    results: parseResults(json("results.json")),
    screenshots,
  };
}
