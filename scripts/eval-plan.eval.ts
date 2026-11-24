import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { runOrchestrator } from "@/server/agents";
import { readPlanContext } from "@/server/agents/context";
import type { Plan, PlanContext } from "@/server/agents/contracts";
import { getBaseSha } from "@/server/github/repo";
import { modelsFor } from "@/server/llm";
import {
  GeminiProvider,
  type GeminiResponse,
  type QuotaMemory,
} from "@/server/llm/gemini";
import { RateLimited, type CallMeta } from "@/server/llm/provider";

/**
 * pnpm eval:plan (D30): the four requests of D14 against Gemini, with the
 * real context of crm-demo. Saves each plan in docs/evals/ and the raw
 * answers as fixtures for the Vitest suite. Spends 4 requests or more of
 * the daily quota: run it by hand. Requests that already have a plan are
 * skipped (EVAL_FORCE=1 plans them again).
 */

config({ path: [".env.local", ".env"], quiet: true });

const REQUESTS = [
  {
    slug: "nif",
    request:
      "Añade el NIF a los clientes: se introduce en el formulario de alta y edición y se ve en el detalle y en la lista.",
  },
  {
    slug: "buscador",
    request:
      "Añade un buscador en la lista de clientes que filtre por nombre o por email.",
  },
  {
    slug: "facturas-vencidas",
    request:
      "Marca las facturas vencidas: las que siguen pendientes de pago con la fecha de vencimiento ya pasada deben destacarse en la lista de facturas.",
  },
  {
    slug: "contacto",
    request:
      "Añade una página de contacto con el email y el teléfono de la empresa, enlazada desde el menú.",
  },
];

/** Requests per minute of the Flash models (D26). */
const PAUSE_MS = 13_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const memoryQuota = (): QuotaMemory => {
  const exhausted = new Set<string>();
  return {
    isExhausted: async (m) => exhausted.has(m),
    markExhausted: async (m) => void exhausted.add(m),
  };
};

type Result = {
  slug: string;
  request: string;
  plan: Plan;
  calls: CallMeta[];
};

function markdown(baseSha: string, results: Result[], at: string): string {
  const lines = [
    "# Evals del Orquestador (`pnpm eval:plan`)",
    "",
    `Generado el ${at} contra Gemini, con el contexto real de \`crm-demo\` en \`${baseSha.slice(0, 7)}\` (D27, D30). Cada plan está completo en su JSON.`,
    "",
    "| Petición | Viable | Tareas | Criterios (e2e / visual) | Llamadas | Modelo | Tokens (entrada → salida) | Latencia |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const r of results) {
    const criteria = r.plan.tasks.flatMap((t) => t.acceptanceCriteria);
    const e2e = criteria.filter((c) => c.type === "e2e").length;
    const sum = (f: (c: CallMeta) => number) =>
      r.calls.reduce((n, c) => n + f(c), 0);
    lines.push(
      `| [${r.slug}](plan-${r.slug}.json) | ${r.plan.feasible ? "sí" : "no"} | ${r.plan.tasks.length} | ${criteria.length} (${e2e} / ${criteria.length - e2e}) | ${r.calls.length} | ${r.calls.at(-1)?.model ?? ""} | ${sum((c) => c.inputTokens)} → ${sum((c) => c.outputTokens)} | ${(sum((c) => c.latencyMs) / 1000).toFixed(1)} s |`,
    );
  }
  for (const r of results) {
    lines.push("", `## ${r.slug}`, "", `> ${r.request}`, "", r.plan.summary);
    if (r.plan.assumptions.length > 0) {
      lines.push("", "Supuestos:", ...r.plan.assumptions.map((a) => `- ${a}`));
    }
    r.plan.tasks.forEach((t, i) => {
      lines.push(
        "",
        `${i + 1}. **${t.title}** · ${t.files.map((f) => `\`${f}\``).join(", ")}`,
        ...t.acceptanceCriteria.map(
          (c) => `   - \`${c.id}\` ${c.type}: ${c.text}`,
        ),
      );
    });
  }
  return lines.join("\n") + "\n";
}

describe("eval:plan (D14, D30)", () => {
  it("plans the four demo requests with Gemini", async () => {
    expect(process.env.GEMINI_API_KEY, "GEMINI_API_KEY").toBeTruthy();
    expect(process.env.GH_TOKEN, "GH_TOKEN").toBeTruthy();

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    let raw: GeminiResponse[] = [];
    const provider = new GeminiProvider({
      generate: async (params) => {
        const response = await client.models.generateContent(params);
        raw.push(JSON.parse(JSON.stringify(response)) as GeminiResponse);
        return response;
      },
      models: modelsFor("orchestrator"),
      quota: memoryQuota(),
    });

    const baseSha = await getBaseSha();
    const context: PlanContext = await readPlanContext(baseSha);
    const results: Result[] = [];
    let requests = 0;

    let first = true;
    for (const { slug, request } of REQUESTS) {
      const file = `docs/evals/plan-${slug}.json`;
      if (existsSync(file) && !process.env.EVAL_FORCE) {
        const saved = JSON.parse(readFileSync(file, "utf8")) as Result;
        results.push({ ...saved, slug });
        console.log(`${slug}: ya planificada, se salta`);
        continue;
      }
      if (!first) await sleep(PAUSE_MS);
      first = false;
      raw = [];
      const input = {
        runId: 0,
        request,
        planRevision: 1,
        mode: "replace" as const,
        feedback: null,
        previous: null,
        context,
      };
      let generated;
      try {
        generated = await runOrchestrator(provider, input);
      } catch (error) {
        if (!(error instanceof RateLimited)) throw error;
        // A local script may wait: the app never does (D26).
        console.log(`${slug}: ${error.message}`);
        await sleep(error.retryAfterMs + 2_000);
        generated = await runOrchestrator(provider, input);
      }
      requests += generated.calls.length;
      const { output: plan, calls } = generated;
      results.push({ slug, request, plan, calls });

      writeFileSync(
        file,
        JSON.stringify({ request, baseSha, plan, calls }, null, 2) + "\n",
      );
      mkdirSync("src/server/llm/fixtures/gemini/recorded", { recursive: true });
      writeFileSync(
        `src/server/llm/fixtures/gemini/recorded/plan-${slug}.json`,
        JSON.stringify(raw.at(-1), null, 2) + "\n",
      );
      console.log(
        `${slug}: ${plan.tasks.length} tareas · ${calls.map((c) => `${c.model} ${c.kind} ${c.inputTokens}→${c.outputTokens} ${c.latencyMs} ms`).join(" · ")}`,
      );

      expect(plan.feasible, `${slug} debe ser viable`).toBe(true);
      expect(plan.tasks.length).toBeGreaterThanOrEqual(1);
      expect(plan.tasks.length).toBeLessThanOrEqual(4);
    }

    writeFileSync(
      "docs/evals/README.md",
      markdown(baseSha, results, new Date().toISOString().slice(0, 10)),
    );
    console.log(`Peticiones a Gemini: ${requests}`);
  });
});
