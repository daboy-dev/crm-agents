import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { appMeta } from "@/server/db/schema";
import type { QuotaMemory } from "./chain";

/**
 * Gemini's daily quotas reset at midnight Pacific time, 9:00 in Madrid
 * (D26). A link marked today is skipped until then; Groq's links too, even
 * if its daily limits reset earlier (D36).
 */
export const quotaDay = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(
    now,
  );

/** Per link of the chain, "provider:model" (D36). */
const key = (id: string) => `llm_quota_exhausted:${id}`;

/** Exhausted links in app_meta, so later calls today do not spend a request. */
export function appMetaQuota(): QuotaMemory {
  const db = getDb();
  return {
    async isExhausted(id) {
      const [row] = await db
        .select({ value: appMeta.value })
        .from(appMeta)
        .where(eq(appMeta.key, key(id)));
      return row?.value === quotaDay();
    },
    async markExhausted(id) {
      await db
        .insert(appMeta)
        .values({ key: key(id), value: quotaDay() })
        .onConflictDoUpdate({
          target: appMeta.key,
          set: { value: quotaDay(), updatedAt: new Date() },
        });
    },
  };
}
