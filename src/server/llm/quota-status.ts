import { like } from "drizzle-orm";
import type { AgentName } from "@/server/agents/contracts";
import type { Db } from "@/server/db/client";
import { appMeta } from "@/server/db/schema";
import { chainFor, linkId, type Link } from "./chain";
import { quotaDay } from "./quota";

export type AgentQuota = {
  agent: AgentName;
  /** Link the next call would use; null when every link is exhausted. */
  next: string | null;
  /** The next call goes to the paid backup (D37). */
  paid: boolean;
  /** Some Gemini link of the chain is exhausted today. */
  geminiExhausted: boolean;
};

/**
 * Where each agent's next call goes, for the warning of the /runs home
 * (D48). Pure: the exhausted links come from app_meta.
 */
export function quotaStatus(
  chains: readonly { agent: AgentName; links: readonly Link[] }[],
  exhausted: ReadonlySet<string>,
): AgentQuota[] {
  return chains.map(({ agent, links }) => {
    const next = links.find((l) => !exhausted.has(linkId(l))) ?? null;
    return {
      agent,
      next: next ? linkId(next) : null,
      paid: next?.provider === "anthropic",
      geminiExhausted: links.some(
        (l) => l.provider === "gemini" && exhausted.has(linkId(l)),
      ),
    };
  });
}

/** Links marked exhausted today (quota.ts). */
export async function exhaustedLinks(db: Db): Promise<Set<string>> {
  const prefix = "llm_quota_exhausted:";
  const rows = await db
    .select({ key: appMeta.key, value: appMeta.value })
    .from(appMeta)
    .where(like(appMeta.key, `${prefix}%`));
  const today = quotaDay();
  return new Set(
    rows
      .filter((r) => r.value === today)
      .map((r) => r.key.slice(prefix.length)),
  );
}

/** Status of the agents that use a real chain in new runs. */
export async function readQuotaStatus(
  db: Db,
  agents: readonly AgentName[],
): Promise<AgentQuota[]> {
  if (agents.length === 0) return [];
  const exhausted = await exhaustedLinks(db);
  return quotaStatus(
    agents.map((agent) => ({ agent, links: chainFor(agent) })),
    exhausted,
  );
}
