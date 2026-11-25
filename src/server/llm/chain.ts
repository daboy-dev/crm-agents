import { z } from "zod";
import type { AgentName } from "@/server/agents/contracts";
import {
  InvalidOutput,
  OutputTruncated,
  Overloaded,
  QuotaExhausted,
  RateLimited,
  type CallMeta,
  type GenerateRequest,
  type Generated,
  type LLMProvider,
} from "./provider";

/**
 * Chain of provider:model links per agent (D36). Every link follows the
 * rules of D26: a daily 429 moves to the next link and is remembered, a
 * per-minute 429 postpones the step, a 5xx moves on without marking it, and
 * a link whose tokens per minute cannot hold the request is skipped without
 * spending a request.
 */

export const LINK_PROVIDERS = ["gemini", "groq"] as const;
export type LinkProvider = (typeof LINK_PROVIDERS)[number];

export type Link = { provider: LinkProvider; model: string };

export const linkId = (link: Link) => `${link.provider}:${link.model}`;

/** Parses "gemini:gemini-3.8-flash,groq:openai/gpt-oss-120b". */
export function parseChain(value: string): Link[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.indexOf(":");
      const provider = part.slice(0, at);
      const model = part.slice(at + 1).trim();
      if (at < 1 || !model || !LINK_PROVIDERS.includes(provider as never)) {
        throw new Error(`Eslabón no válido en la cadena de LLM: "${part}"`);
      }
      return { provider: provider as LinkProvider, model };
    });
}

// --- Per agent settings (D26, D35) ---

export type Thinking = "minimal" | "low";

export type AgentSettings = {
  /** Per request. The lease is renewed to this plus a margin (D35). */
  timeoutMs: number;
  /** Reasoning tokens count inside this limit on Gemini. */
  maxOutputTokens: number;
  thinking: Thinking;
};

export const AGENT_SETTINGS: Record<AgentName, AgentSettings> = {
  orchestrator: {
    timeoutMs: 60_000,
    maxOutputTokens: 16_384,
    thinking: "minimal",
  },
  develop: { timeoutMs: 150_000, maxOutputTokens: 32_768, thinking: "low" },
  testing: { timeoutMs: 60_000, maxOutputTokens: 8_192, thinking: "minimal" },
};

/** The lease outlives the longest request of the agent (D35). */
export const LEASE_MARGIN_SECONDS = 30;
export const leaseSecondsFor = (agent: AgentName) =>
  Math.ceil(AGENT_SETTINGS[agent].timeoutMs / 1000) + LEASE_MARGIN_SECONDS;

const GEMINI_FALLBACK =
  "gemini:gemini-3.8-flash,gemini:gemini-3.6-flash,gemini:gemini-3.5-flash-lite";

/**
 * Default chains. Groq backs up only the orchestrator: Develop's context does
 * not fit its 8K tokens per minute, and Testing needs images (D36).
 */
export const DEFAULT_CHAINS: Record<AgentName, string> = {
  orchestrator: `${GEMINI_FALLBACK},groq:openai/gpt-oss-120b`,
  develop: GEMINI_FALLBACK,
  testing: GEMINI_FALLBACK,
};

/** LLM_CHAIN_<AGENT>, or the default chain of the agent. */
export const chainFor = (agent: AgentName): Link[] =>
  parseChain(
    process.env[`LLM_CHAIN_${agent.toUpperCase()}`] || DEFAULT_CHAINS[agent],
  );

// --- Links ---

export type Message = { role: "user" | "model"; text: string };

export type CompletionRequest = {
  system: string;
  messages: Message[];
  schema: z.ZodType;
  maxOutputTokens: number;
  timeoutMs: number;
  thinking: Thinking;
};

export type Completion = {
  text: string;
  /** max_tokens: the answer was cut and its JSON is incomplete. */
  finish: "stop" | "max_tokens" | "other";
  inputTokens: number;
  outputTokens: number;
};

/** What the chain does with an error of a link. */
export type LinkError =
  | { kind: "daily" }
  | { kind: "minute"; retryAfterMs: number }
  /** 5xx: another link may answer now. */
  | { kind: "overloaded" }
  /** The request is over a limit of the link (Groq's 413). */
  | { kind: "too_large" };

/** One provider:model of the chain. */
export interface ModelClient {
  readonly id: string;
  /** Tokens per minute of the link: a larger request is skipped. */
  readonly tokensPerMinute: number;
  complete(request: CompletionRequest): Promise<Completion>;
  classify(error: unknown): LinkError | null;
}

/** Remembers which links ran out of their daily quota today (D26). */
export type QuotaMemory = {
  isExhausted(id: string): Promise<boolean>;
  markExhausted(id: string): Promise<void>;
};

// --- Output parsing and repair ---

/** Zod issues as a short list for the repair prompt and the logs. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 20)
    .map((i) => `- ${i.path.join(".") || "(raíz)"}: ${i.message}`)
    .join("\n");
}

type Parsed<T> = { ok: true; value: T } | { ok: false; problems: string };

export function parseOutput<T>(text: string, schema: z.ZodType<T>): Parsed<T> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      problems: `- La respuesta no es JSON válido: ${(error as Error).message}`,
    };
  }
  const result = schema.safeParse(json);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, problems: describeIssues(result.error) };
}

export const repairPrompt = (problems: string) =>
  [
    "Tu respuesta anterior no cumple el contrato. Errores:",
    problems,
    "",
    "Devuelve de nuevo el JSON completo, corregido y sin texto alrededor.",
  ].join("\n");

// --- Sizing ---

/** Rough count: about four characters per token. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/** Below this the answer would surely be cut: the link is skipped. */
export const MIN_OUTPUT_TOKENS = 1_024;

/**
 * Output budget of a link for a request: the agent's limit, lowered so that
 * input plus output fit in the link's tokens per minute. Null when the link
 * cannot hold the request.
 */
export function outputBudget(
  tokensPerMinute: number,
  inputTokens: number,
  maxOutputTokens: number,
): number | null {
  const budget = Math.min(maxOutputTokens, tokensPerMinute - inputTokens);
  return budget >= MIN_OUTPUT_TOKENS ? budget : null;
}

const requestText = (system: string, messages: Message[], schema: z.ZodType) =>
  system +
  messages.map((m) => m.text).join("") +
  JSON.stringify(z.toJSONSchema(schema, { unrepresentable: "any" }));

// --- Provider ---

export class ChainProvider implements LLMProvider {
  readonly name = "gemini";

  constructor(
    private readonly options: {
      links: ModelClient[];
      quota: QuotaMemory;
      settings: AgentSettings;
    },
  ) {
    if (options.links.length === 0) throw new Error("Cadena de LLM vacía");
  }

  async generateObject<T>(request: GenerateRequest<T>): Promise<Generated<T>> {
    const { links, quota } = this.options;
    const skipped: string[] = [];
    /** Links that answered 500, 503 or 504: busy, not out of quota. */
    const busy: string[] = [];
    for (const link of links) {
      if (await quota.isExhausted(link.id)) {
        skipped.push(`${link.id}: cuota diaria agotada`);
        continue;
      }
      try {
        return await this.withLink(link, request, skipped);
      } catch (error) {
        if (error instanceof SkipLink) continue;
        const kind = link.classify(error);
        if (kind?.kind === "daily") {
          await quota.markExhausted(link.id);
          skipped.push(`${link.id}: cuota diaria agotada`);
          continue;
        }
        if (kind?.kind === "minute") {
          throw new RateLimited(link.id, kind.retryAfterMs);
        }
        if (kind?.kind === "too_large") {
          skipped.push(`${link.id}: la petición supera su límite`);
          continue;
        }
        if (kind?.kind === "overloaded") {
          // Not a quota: try the next link now, without marking this one.
          busy.push(link.id);
          continue;
        }
        throw error;
      }
    }
    // The last links were out of quota but an earlier one was only busy.
    // Some links were busy and none answered: try again later (D26).
    if (busy.length > 0) throw new Overloaded(busy);
    throw new QuotaExhausted(skipped);
  }

  /** First call and, if it does not validate, a single repair call. */
  private async withLink<T>(
    link: ModelClient,
    request: GenerateRequest<T>,
    skipped: string[],
  ): Promise<Generated<T>> {
    const { settings } = this.options;
    const calls: CallMeta[] = [];
    const messages: Message[] = [{ role: "user", text: request.prompt }];
    for (const kind of ["first", "repair"] as const) {
      const input = estimateTokens(
        requestText(request.system, messages, request.schema),
      );
      const budget = outputBudget(
        link.tokensPerMinute,
        input,
        settings.maxOutputTokens,
      );
      if (budget === null) {
        // Only the first call can skip: a repair has spent requests already.
        if (kind === "first") {
          skipped.push(
            `${link.id}: la petición (~${input} tokens) no cabe en ${link.tokensPerMinute} tokens por minuto`,
          );
          throw new SkipLink();
        }
        throw new InvalidOutput(
          `${link.id}: la llamada de reparación no cabe en ${link.tokensPerMinute} tokens por minuto`,
          calls,
        );
      }

      await request.hooks?.beforeCall?.();
      const started = Date.now();
      const completion = await link.complete({
        system: request.system,
        messages,
        schema: request.schema,
        maxOutputTokens: budget,
        timeoutMs: settings.timeoutMs,
        thinking: settings.thinking,
      });
      const meta = {
        model: link.id,
        kind,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        latencyMs: Date.now() - started,
      };

      if (completion.finish === "max_tokens") {
        // The JSON is incomplete and a repair would be cut again (D34).
        const call = { ...meta, valid: false };
        calls.push(call);
        await request.hooks?.onCall?.(call);
        throw new OutputTruncated(link.id, budget, calls);
      }

      const parsed = parseOutput(completion.text, request.schema);
      const call = { ...meta, valid: parsed.ok };
      calls.push(call);
      await request.hooks?.onCall?.(call);
      if (parsed.ok) return { output: parsed.value, calls };
      if (kind === "repair") {
        throw new InvalidOutput(
          `${link.id}: la respuesta no cumple el contrato tras la reparación:\n${parsed.problems}`,
          calls,
        );
      }
      messages.push(
        { role: "model", text: completion.text },
        { role: "user", text: repairPrompt(parsed.problems) },
      );
    }
    throw new Error("unreachable");
  }
}

/** The link cannot hold the request: go on with the next one. */
class SkipLink extends Error {}
