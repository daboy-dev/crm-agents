import packageJson from "../../package.json";
import { appMeta } from "./db/schema";
import type { Db } from "./db/client";

export type HealthReport = {
  ok: boolean;
  db: boolean;
  version: string;
};

export type HealthDeps = {
  /** Runs a real query against the database; must throw if it is unreachable. */
  pingDb: () => Promise<void>;
  version: string;
};

export async function checkHealth(deps: HealthDeps): Promise<HealthReport> {
  let db = false;
  try {
    await deps.pingDb();
    db = true;
  } catch {
    db = false;
  }
  return { ok: db, db, version: deps.version };
}

/** Selects from `app_meta`, so it also fails if the migration was not applied. */
export function createDbPing(getDb: () => Db): () => Promise<void> {
  return async () => {
    await getDb().select({ key: appMeta.key }).from(appMeta).limit(1);
  };
}

export function appVersion(): string {
  const base = packageJson.version;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return sha ? `${base}+${sha}` : base;
}
