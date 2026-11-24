import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { appMeta } from "@/server/db/schema";
import type { QuotaMemory } from "./gemini";

/**
 * Gemini's daily quotas reset at midnight Pacific time, 9:00 in Madrid
 * (D26). A model marked today is skipped until then.
 */
export const quotaDay = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(
    now,
  );

const key = (model: string) => `gemini_quota_exhausted:${model}`;

/** Exhausted models in app_meta, so later calls today do not spend a request. */
export function appMetaQuota(): QuotaMemory {
  const db = getDb();
  return {
    async isExhausted(model) {
      const [row] = await db
        .select({ value: appMeta.value })
        .from(appMeta)
        .where(eq(appMeta.key, key(model)));
      return row?.value === quotaDay();
    },
    async markExhausted(model) {
      await db
        .insert(appMeta)
        .values({ key: key(model), value: quotaDay() })
        .onConflictDoUpdate({
          target: appMeta.key,
          set: { value: quotaDay(), updatedAt: new Date() },
        });
    },
  };
}
