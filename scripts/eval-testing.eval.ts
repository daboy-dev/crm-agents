import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { runOrchestrator, runTestingSteps } from "@/server/agents";
import { readPlanContext } from "@/server/agents/context";
import type {
  AgentName,
  CriteriaSteps,
  Plan,
  StepsInput,
} from "@/server/agents/contracts";
import { PAGES_FILE } from "@/server/agents/paths";
import { getBaseSha, getFileText } from "@/server/github/repo";
import { AnthropicClient } from "@/server/llm/anthropic";
import {
  AGENT_SETTINGS,
  ChainProvider,
  chainFor,
  type ModelClient,
  type QuotaMemory,
} from "@/server/llm/chain";
import { GeminiClient } from "@/server/llm/gemini";
import { GroqClient } from "@/server/llm/groq";
import { RateLimited, type CallMeta } from "@/server/llm/provider";
import { pageNames } from "@/server/runs/criteria";

/**
 * pnpm eval:testing (H6, D38): the demo requests of the extra of D14. The
 * orchestrator plans each one with the criteria's data-testid, and Testing
 * writes the steps of its criteria with its own chain (D40). Everything is
 * validated with Zod and saved in docs/evals/; the raw answers go to the
 * fixtures for Vitest. Spends quota: run it by hand. Saved plans and steps
 * are reused (EVAL_FORCE=1 asks for them again).
 *
 * EVAL_ONLY=notas-cliente repeats one request and leaves the README alone.
 *
 * Testing with another chain, on the same plans:
 * LLM_CHAIN_TESTING=groq:openai/gpt-oss-120b EVAL_TAG=groq pnpm eval:testing
 * saves steps-groq-<slug>.json and leaves the README alone.
 */

config({ path: [".env.local", ".env"], quiet: true });

const REQUESTS = [
  {
    slug: "filtro-facturas",
    request:
      "Añade un filtro por estado en la lista de facturas: un desplegable que deja ver solo las pendientes, las pagadas o todas.",
  },
  {
    slug: "notas-cliente",
    request:
      "Añade un campo de notas internas a los clientes: se escribe en el formulario de alta y edición y se ve en el detalle del cliente.",
  },
  {
    slug: "duplicar-presupuesto",
    request:
      "Añade un botón en el detalle de un presupuesto para duplicarlo: crea un presupuesto nuevo en borrador con el mismo cliente y las mismas líneas.",
  },
  {
    slug: "resumen",
    request:
      "Añade una página de resumen, enlazada desde el menú, con el número de clientes, los presupuestos enviados y el importe pendiente de cobro.",
  },
];

const EXAMPLE_SPECS = ["e2e/write-flow.spec.ts"];
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

type Raw = { provider: "gemini" | "groq" | "anthropic"; body: unknown };

/** The agent's chain, keeping every raw answer of the APIs. */
function recordingChain(agent: AgentName, raw: Raw[]): ModelClient[] {
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  return chainFor(agent).map((link) => {
    if (link.provider === "gemini") {
      return new GeminiClient(link.model, async (params) => {
        const response = await gemini.models.generateContent(params);
        raw.push({
          provider: "gemini",
          body: JSON.parse(JSON.stringify(response)),
        });
        return response;
      });
    }
    if (link.provider === "anthropic") {
      return new AnthropicClient(
        link.model,
        new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" }),
      );
    }
    return new GroqClient(link.model, {
      apiKey: process.env.GROQ_API_KEY ?? "",
      fetch: async (url, init) => {
        const response = await fetch(url, init);
        if (response.ok) {
          raw.push({ provider: "groq", body: await response.clone().json() });
        }
        return response;
      },
    });
  });
}

/** A local script may wait on a per-minute 429: the app never does (D26). */
async function withRetry<T>(slug: string, call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof RateLimited) || attempt >= 5) throw error;
      console.log(`${slug}: ${error.message}`);
      await sleep(error.retryAfterMs + 2_000);
    }
  }
}

function record(raw: Raw[], name: string) {
  const last = raw.at(-1);
  if (!last || last.provider === "anthropic") return;
  const dir = `src/server/llm/fixtures/${last.provider}/recorded`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/${name}.json`,
    JSON.stringify(last.body, null, 2) + "\n",
  );
}

type Result = {
  slug: string;
  request: string;
  plan: Plan;
  planCalls: CallMeta[];
  steps: CriteriaSteps;
  stepsCalls: CallMeta[];
};

const sum = (calls: CallMeta[], f: (c: CallMeta) => number) =>
  calls.reduce((n, c) => n + f(c), 0);
const callsLine = (calls: CallMeta[]) =>
  `${calls.length} · ${calls.at(-1)?.model ?? ""} · ${sum(calls, (c) => c.inputTokens)} → ${sum(calls, (c) => c.outputTokens)} · ${(sum(calls, (c) => c.latencyMs) / 1000).toFixed(1)} s`;

function markdown(baseSha: string, results: Result[], at: string): string {
  const lines = [
    "# Evals de Testing (`pnpm eval:testing`)",
    "",
    `Generado el ${at} con el contexto real de \`crm-demo\` en \`${baseSha.slice(0, 7)}\`. El Orquestador planifica cada petición con los \`data-testid\` de sus criterios (D38) y Testing escribe los pasos con su cadena (D40). Todo valida con Zod; los planes y los pasos están completos en sus JSON.`,
    "",
    "| Petición | Tareas | Criterios | Pasos | Plan (llamadas · modelo · tokens · latencia) | Pasos (llamadas · modelo · tokens · latencia) |",
    "|---|---|---|---|---|---|",
  ];
  for (const r of results) {
    const criteria = r.plan.tasks.flatMap((t) => t.acceptanceCriteria);
    const steps = r.steps.criteria.reduce((n, c) => n + c.steps.length, 0);
    lines.push(
      `| [${r.slug}](plan-h6-${r.slug}.json) | ${r.plan.tasks.length} | ${criteria.length} | [${steps}](steps-${r.slug}.json) | ${callsLine(r.planCalls)} | ${callsLine(r.stepsCalls)} |`,
    );
  }
  for (const r of results) {
    lines.push("", `## ${r.slug}`, "", `> ${r.request}`, "", r.plan.summary);
    r.plan.tasks.forEach((t, i) => {
      lines.push(
        "",
        `${i + 1}. **${t.title}** · ${t.files.map((f) => `\`${f}\``).join(", ")}`,
      );
      for (const c of t.acceptanceCriteria) {
        const steps = r.steps.criteria.find((s) => s.id === c.id)?.steps ?? [];
        lines.push(
          `   - \`${c.id}\`: ${c.text} · ${c.testIds.map((id) => `\`${id}\``).join(", ")}`,
          ...steps.map((s) => `     - \`${JSON.stringify(s)}\``),
        );
      }
    });
  }
  return lines.join("\n") + "\n";
}

describe("eval:testing (D38, D40)", () => {
  it("plans the H6 demo requests and writes the steps of their criteria", async () => {
    expect(process.env.GH_TOKEN, "GH_TOKEN").toBeTruthy();
    const tag = process.env.EVAL_TAG ? `${process.env.EVAL_TAG}-` : "";

    const planRaw: Raw[] = [];
    const stepsRaw: Raw[] = [];
    const orchestrator = new ChainProvider({
      links: recordingChain("orchestrator", planRaw),
      quota: memoryQuota(),
      settings: AGENT_SETTINGS.orchestrator,
    });
    const testing = new ChainProvider({
      links: recordingChain("testing", stepsRaw),
      quota: memoryQuota(),
      settings: AGENT_SETTINGS.testing,
    });

    const baseSha = await getBaseSha();
    const context = await readPlanContext(baseSha);
    const pages = pageNames(await getFileText(PAGES_FILE, baseSha));
    const examples = (
      await Promise.all(
        EXAMPLE_SPECS.map(async (path) => ({
          path,
          content: await getFileText(path, baseSha),
        })),
      )
    ).flatMap((e) => (e.content ? [{ path: e.path, content: e.content }] : []));

    const results: Result[] = [];
    let requests = 0;
    // EVAL_ONLY=slug1,slug2 repeats some requests; the README needs all four.
    const only = process.env.EVAL_ONLY?.split(",");
    const selected = REQUESTS.filter((r) => !only || only.includes(r.slug));
    for (const [i, { slug, request }] of selected.entries()) {
      if (i > 0) await sleep(PAUSE_MS);
      const planFile = `docs/evals/plan-h6-${slug}.json`;
      let plan: Plan;
      let planCalls: CallMeta[];
      if (existsSync(planFile) && !process.env.EVAL_FORCE) {
        ({ plan, calls: planCalls } = JSON.parse(
          readFileSync(planFile, "utf8"),
        ) as {
          plan: Plan;
          calls: CallMeta[];
        });
        console.log(`${slug}: plan guardado, se reutiliza`);
      } else {
        planRaw.length = 0;
        const generated = await withRetry(slug, () =>
          runOrchestrator(orchestrator, {
            runId: 0,
            request,
            planRevision: 1,
            mode: "replace",
            feedback: null,
            previous: null,
            context,
          }),
        );
        ({ output: plan, calls: planCalls } = generated);
        requests += planCalls.length;
        writeFileSync(
          planFile,
          JSON.stringify(
            { request, baseSha, plan, calls: planCalls },
            null,
            2,
          ) + "\n",
        );
        record(planRaw, `plan-${slug}`);
        await sleep(PAUSE_MS);
      }
      expect(plan.feasible, `${slug} debe ser viable`).toBe(true);

      const input: StepsInput = {
        runId: 0,
        request,
        planRevision: 1,
        tasks: plan.tasks.map((t, n) => ({
          position: n + 1,
          title: t.title,
          description: t.description,
        })),
        criteria: plan.tasks.flatMap((t, n) =>
          t.acceptanceCriteria.map((c) => ({
            id: c.id,
            task: n + 1,
            text: c.text,
            testIds: c.testIds,
          })),
        ),
        pages,
        examples,
      };
      const stepsFile = `docs/evals/steps-${tag}${slug}.json`;
      if (existsSync(stepsFile) && !process.env.EVAL_FORCE && !only) {
        const saved = JSON.parse(readFileSync(stepsFile, "utf8")) as {
          steps: CriteriaSteps;
          calls: CallMeta[];
        };
        results.push({
          slug,
          request,
          plan,
          planCalls,
          steps: saved.steps,
          stepsCalls: saved.calls,
        });
        console.log(`${slug}: pasos guardados, se reutilizan`);
        continue;
      }
      stepsRaw.length = 0;
      const { output: steps, calls: stepsCalls } = await withRetry(slug, () =>
        runTestingSteps(testing, input),
      );
      requests += stepsCalls.length;
      writeFileSync(
        `docs/evals/steps-${tag}${slug}.json`,
        JSON.stringify(
          { request, baseSha, steps, calls: stepsCalls },
          null,
          2,
        ) + "\n",
      );
      record(stepsRaw, `steps-${slug}`);
      results.push({ slug, request, plan, planCalls, steps, stepsCalls });
      console.log(
        `${slug}: ${plan.tasks.length} tareas, ${input.criteria.length} criterios · plan ${callsLine(planCalls)} · pasos ${callsLine(stepsCalls)}`,
      );
      expect(steps.criteria.map((c) => c.id).sort()).toEqual(
        input.criteria.map((c) => c.id).sort(),
      );
    }

    if (!tag && !only) {
      writeFileSync(
        "docs/evals/TESTING.md",
        markdown(baseSha, results, new Date().toISOString().slice(0, 10)),
      );
    }
    console.log(`Peticiones al LLM: ${requests}`);
  });
});
