import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { runDevelop } from "@/server/agents";
import type { DevelopOutput, Plan } from "@/server/agents/contracts";
import {
  readDevelopContext,
  type RepoReader,
} from "@/server/agents/develop-context";
import { normalizeContent } from "@/server/agents/files";
import { checkFeedback } from "@/server/pipeline/checks";
import { checkPaths } from "@/server/agents/paths";
import {
  AGENT_SETTINGS,
  ChainProvider,
  chainFor,
  type QuotaMemory,
} from "@/server/llm/chain";
import { GeminiClient } from "@/server/llm/gemini";
import { MockProvider } from "@/server/llm/mock";
import {
  OutputTruncated,
  RateLimited,
  type CallMeta,
  type LLMProvider,
} from "@/server/llm/provider";

/**
 * pnpm eval:develop (H5 criterion): Develop solves the tasks of each plan in
 * docs/evals/ against Gemini, on a throwaway worktree of the local crm-demo
 * clone at the plan's base sha. Each task reads its context from disk with
 * readDevelopContext, as the panel does on GitHub (D32). Then the same
 * checks as pr-check run: drizzle-kit generate, tsc and ESLint (D31, D33).
 * Saves docs/evals/develop-<slug>.json and .diff, DEVELOP.md and the raw
 * answers as fixtures. Spends about one request per task: run it by hand.
 * EVAL_FORCE=1 repeats plans already done; EVAL_MOCK=1 uses the mock to try
 * the pipeline without spending quota (nothing is saved).
 */

config({ path: [".env.local", ".env"], quiet: true });

const CRM_DEMO = resolve("../crm-demo");
const SLUGS = ["nif", "contacto", "facturas-vencidas", "buscador"];
const MOCK = process.env.EVAL_MOCK === "1";
/** Requests per minute of the Flash models (D26). */
const PAUSE_MS = 13_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const memoryQuota = (): QuotaMemory => {
  const exhausted = new Set<string>();
  return {
    isExhausted: async (id) => exhausted.has(id),
    markExhausted: async (id) => void exhausted.add(id),
  };
};

function developProvider(raw: unknown[]): LLMProvider {
  if (MOCK) return new MockProvider("ok");
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  return new ChainProvider({
    links: chainFor("develop")
      .filter((l) => l.provider === "gemini")
      .map(
        (l) =>
          new GeminiClient(l.model, async (params) => {
            const response = await gemini.models.generateContent(params);
            raw.push(JSON.parse(JSON.stringify(response)));
            return response;
          }),
      ),
    quota: memoryQuota(),
    settings: AGENT_SETTINGS.develop,
  });
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** The worktree as Develop's repo: tracked and new files. */
const diskReader = (dir: string): RepoReader => ({
  paths: async () =>
    git(dir, "ls-files", "--cached", "--others", "--exclude-standard")
      .split("\n")
      .filter(Boolean),
  text: async (path) => {
    const file = join(dir, path);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  },
});

type Step = { ok: boolean; output: string | null };

/**
 * node_modules is a symlink to the local clone's: pnpm must not try to
 * install into it before running a binary.
 */
const PNPM = ["--config.verify-deps-before-run=false"];

/** Like a pr-check job step: no TTY, a timeout and trimmed output. */
function run(dir: string, args: string[], timeoutMs = 180_000): Step {
  const r = spawnSync("pnpm", [...PNPM, "exec", ...args], {
    cwd: dir,
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`
    .replace(/\u001b\[[0-9;]*m/g, "")
    .slice(0, 20_000);
  return { ok: r.status === 0, output: r.status === 0 ? null : output };
}

/** The checks of pr-check.yml (D31, D33), with its drizzle-kit rule. */
function prCheck(dir: string) {
  const r = spawnSync("pnpm", [...PNPM, "exec", "drizzle-kit", "generate"], {
    cwd: dir,
    encoding: "utf8",
    timeout: 120_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = `${r.stdout ?? ""}${r.stderr ?? ""}`.replace(
    /\u001b\[[0-9;]*m/g,
    "",
  );
  // drizzle-kit exits 0 on its errors (seen in crm-demo PR #11).
  const generated =
    r.status === 0 &&
    /Your SQL migration file|No schema changes/.test(log) &&
    !/^\s*Error/m.test(log);
  const migrate: Step = generated
    ? { ok: true, output: null }
    : { ok: false, output: log.slice(0, 20_000) };
  const typegen = run(dir, ["next", "typegen"]);
  const typecheck = typegen.ok
    ? run(dir, ["tsc", "--noEmit", "--pretty", "false"])
    : typegen;
  const lint = run(dir, ["eslint", "--quiet"]);
  const migrations = git(dir, "status", "--porcelain", "--", "drizzle")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3));
  return {
    ok: migrate.ok && typecheck.ok && lint.ok,
    migrate,
    typecheck,
    lint,
    migrations,
  };
}

type TaskResult = {
  position: number;
  title: string;
  status: "committed" | "too_large" | "forbidden" | "error";
  commitMessage?: string;
  notes?: string;
  files?: string[];
  outsidePlan?: string[];
  evidence?: DevelopOutput["evidence"];
  context?: { files: string[]; trimmed: string[]; newFiles: string[] };
  calls: CallMeta[];
  error?: string;
};

async function develop(
  provider: LLMProvider,
  input: Parameters<typeof runDevelop>[1],
) {
  // A local script may wait on a per-minute 429: the app never does (D26).
  for (let attempt = 1; ; attempt++) {
    try {
      return await runDevelop(provider, input);
    } catch (error) {
      if (!(error instanceof RateLimited) || attempt >= 5) throw error;
      console.log(error.message);
      await sleep(error.retryAfterMs + 2_000);
    }
  }
}

type Check = ReturnType<typeof prCheck>;
type Iteration = { iteration: number; tasks: TaskResult[]; check: Check };
type Result = {
  slug: string;
  request: string;
  baseSha: string;
  iterations: Iteration[];
};

/** Iterations like the engine's: pr-check errors go back to Develop (D5, D33). */
const MAX_ITERATIONS = 3;

/** Saved results; the first version stored a single iteration flat. */
function loadResult(file: string): Result {
  const r = JSON.parse(readFileSync(file, "utf8")) as Result & {
    tasks?: TaskResult[];
    check?: Check;
  };
  if (r.iterations) return r;
  return {
    ...r,
    iterations: [{ iteration: 1, tasks: r.tasks!, check: r.check! }],
  };
}

/** The errors of the local pr-check as Develop reads them. */
const feedbackFor = (check: Check) =>
  checkFeedback({
    migrate: check.migrate.ok ? null : check.migrate.output,
    typecheck: check.typecheck.ok ? null : check.typecheck.output,
    lint: check.lint.ok ? null : check.lint.output,
  });

function markdown(results: Result[]): string {
  const mark = (s: Step) => (s.ok ? "✅" : "❌");
  const lines = [
    "# Evals de Develop (`pnpm eval:develop`)",
    "",
    `Generado el ${new Date().toISOString().slice(0, 10)} con la cadena de Develop (D35, D36) sobre los planes de [README.md](README.md). Cada tarea se resuelve con su contexto de D32 sobre un worktree de \`crm-demo\` en el \`baseSha\` del plan, y al final se aplican las comprobaciones de \`pr-check\` (D31, D33). Si fallan, todas las tareas vuelven a Develop con los errores, hasta ${MAX_ITERATIONS} iteraciones, como en el motor. El diff final está en cada \`develop-<petición>.diff\`.`,
    "",
    "| Petición | Tareas | Iteraciones | Llamadas | Modelos | Tokens (entrada → salida) | Migración | tsc | ESLint |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of results) {
    const first = r.iterations[0]!;
    const last = r.iterations.at(-1)!;
    const calls = r.iterations.flatMap((it) =>
      it.tasks.flatMap((t) => t.calls),
    );
    const sum = (f: (c: CallMeta) => number) =>
      calls.reduce((n, c) => n + f(c), 0);
    const check = last.check;
    lines.push(
      `| [${r.slug}](develop-${r.slug}.json) | ${first.tasks.length} | ${r.iterations.length} | ${calls.length} | ${[...new Set(calls.map((c) => c.model))].join(", ")} | ${sum((c) => c.inputTokens)} → ${sum((c) => c.outputTokens)} | ${check.migrate.ok ? (check.migrations.length > 0 ? "✅ generada" : "✅ sin cambios") : "❌"} | ${mark(check.typecheck)} | ${mark(check.lint)} |`,
    );
  }
  for (const r of results) {
    lines.push("", `## ${r.slug}`, "", `> ${r.request}`);
    for (const it of r.iterations) {
      lines.push("", `### Iteración ${it.iteration}`);
      for (const t of it.tasks) {
        lines.push(
          "",
          `${t.position}. **${t.title}** · ${t.status}${t.commitMessage ? ` · \`${t.commitMessage}\`` : ""}`,
        );
        if (t.notes) lines.push(`   - Notas: ${t.notes}`);
        if (t.files) {
          lines.push(
            `   - Archivos: ${t.files.map((f) => `\`${f}\`${t.outsidePlan?.includes(f) ? " (fuera del plan)" : ""}`).join(", ")}`,
          );
        }
        if (t.error) lines.push(`   - Error: ${t.error}`);
      }
      lines.push(
        "",
        `pr-check: ${it.check.ok ? "en verde" : "con errores"} (drizzle-kit ${mark(it.check.migrate)} · tsc ${mark(it.check.typecheck)} · ESLint ${mark(it.check.lint)})`,
      );
      for (const [name, step] of [
        ["drizzle-kit", it.check.migrate],
        ["tsc", it.check.typecheck],
        ["ESLint", it.check.lint],
      ] as const) {
        if (!step.ok) {
          lines.push(
            "",
            "```",
            `${name}: ${(step.output ?? "").trim().slice(0, 3000)}`,
            "```",
          );
        }
      }
    }
  }
  return lines.join("\n") + "\n";
}

describe("eval:develop (H5)", () => {
  it.each(SLUGS)(
    "develops the plan %s and passes pr-check",
    async (slug) => {
      if (!MOCK) {
        expect(process.env.GEMINI_API_KEY, "GEMINI_API_KEY").toBeTruthy();
      }
      const out = `docs/evals/develop-${slug}.json`;
      if (!MOCK && existsSync(out) && !process.env.EVAL_FORCE) {
        console.log(`${slug}: ya hecho, se salta`);
        return;
      }
      const { request, baseSha, plan } = JSON.parse(
        readFileSync(`docs/evals/plan-${slug}.json`, "utf8"),
      ) as { request: string; baseSha: string; plan: Plan };

      const dir = join(
        mkdtempSync(join(tmpdir(), "eval-develop-")),
        "crm-demo",
      );
      git(CRM_DEMO, "worktree", "add", "--detach", dir, baseSha);
      symlinkSync(join(CRM_DEMO, "node_modules"), join(dir, "node_modules"));
      const reader = diskReader(dir);

      const iterations: Iteration[] = [];
      const raw: unknown[] = [];
      const provider = developProvider(raw);
      let feedback: string | null = null;
      try {
        for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
          const tasks: TaskResult[] = [];
          for (const [i, task] of plan.tasks.entries()) {
            if ((i > 0 || iteration > 1) && !MOCK) await sleep(PAUSE_MS);
            const brief = { position: i + 1, ...task };
            const context = await readDevelopContext({
              sha: baseSha,
              task: brief,
              reader,
            });
            const base = {
              position: i + 1,
              title: task.title,
              context: {
                files: context.files.map((f) => `${f.role}:${f.path}`),
                trimmed: context.trimmed,
                newFiles: context.newFiles,
              },
            };
            raw.length = 0;
            let output: DevelopOutput;
            let calls: CallMeta[];
            try {
              ({ output, calls } = await develop(provider, {
                runId: 0,
                request,
                task: brief,
                iteration,
                feedback,
                context,
              }));
            } catch (error) {
              const truncated = error instanceof OutputTruncated;
              tasks.push({
                ...base,
                status: truncated ? "too_large" : "error",
                calls: (error as { calls?: CallMeta[] }).calls ?? [],
                error: (error as Error).message.slice(0, 2000),
              });
              console.log(
                `${slug} i${iteration} t${i + 1}: ${(error as Error).message.slice(0, 300)}`,
              );
              continue;
            }
            const paths = output.files.map((f) => f.path);
            const check = checkPaths(paths);
            if (!check.ok) {
              tasks.push({
                ...base,
                status: "forbidden",
                calls,
                error: check.reason,
              });
              continue;
            }
            // Like the commit chain: normalized complete files (D34).
            for (const f of output.files) {
              const file = join(dir, f.path);
              mkdirSync(dirname(file), { recursive: true });
              writeFileSync(file, normalizeContent(f.content));
            }
            tasks.push({
              ...base,
              status: "committed",
              commitMessage: output.commitMessage,
              notes: output.notes,
              files: paths,
              outsidePlan: paths.filter((p) => !task.files.includes(p)),
              evidence: output.evidence,
              calls,
            });
            console.log(
              `${slug} i${iteration} t${i + 1}: ${output.commitMessage} · ${calls.map((c) => `${c.model} ${c.kind} ${c.inputTokens}→${c.outputTokens} ${c.latencyMs} ms`).join(" · ")}`,
            );
            if (!MOCK && raw.length > 0) {
              const fixtures = "src/server/llm/fixtures/gemini/recorded";
              mkdirSync(fixtures, { recursive: true });
              const suffix = iteration > 1 ? `-i${iteration}` : "";
              writeFileSync(
                `${fixtures}/develop-${slug}-t${i + 1}${suffix}.json`,
                JSON.stringify(raw.at(-1), null, 2) + "\n",
              );
            }
          }
          const check = prCheck(dir);
          iterations.push({ iteration, tasks, check });
          console.log(
            `${slug} i${iteration}: pr-check ${check.ok ? "en verde" : "con errores"} · migraciones: ${check.migrations.join(", ") || "ninguna"}`,
          );
          if (check.ok || tasks.some((t) => t.status !== "committed")) break;
          feedback = feedbackFor(check);
        }

        git(dir, "add", "-A");
        const diff = git(dir, "diff", "--cached");
        const result: Result = { slug, request, baseSha, iterations };
        if (!MOCK) {
          writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
          writeFileSync(`docs/evals/develop-${slug}.diff`, diff + "\n");
        }
        const last = iterations.at(-1)!;
        expect(last.tasks.every((t) => t.status === "committed")).toBe(true);
        expect(last.check.ok, JSON.stringify(last.check, null, 2)).toBe(true);
      } finally {
        git(CRM_DEMO, "worktree", "remove", "--force", dir);
      }
    },
    45 * 60_000,
  );

  it("writes DEVELOP.md from the saved results", () => {
    if (MOCK) return;
    const results = SLUGS.map((s) => `docs/evals/develop-${s}.json`)
      .filter((f) => existsSync(f))
      .map(loadResult);
    if (results.length > 0) {
      writeFileSync("docs/evals/DEVELOP.md", markdown(results));
    }
  });
});
