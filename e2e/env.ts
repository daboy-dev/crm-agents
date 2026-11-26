/**
 * Environment of the panel's E2E (H7, criterion 6). It runs against its own
 * Neon branch, never against production: the seed empties the run tables.
 */

import { config } from "dotenv";

config({ path: ".env.e2e", quiet: true });

/** Test values that only work against the local E2E server. */
export const E2E_USER = "e2e";
export const E2E_PASSWORD = "e2e-panel-password";
const E2E_AUTH_SECRET = "e2e-auth-secret-not-used-anywhere-else-000";

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

const host = (url: string | undefined) => {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
};

/** Production's DATABASE_URL, as `vercel env pull` leaves it. */
function productionHost(): string | null {
  const local: Record<string, string> = {};
  config({ path: ".env.local", processEnv: local, quiet: true });
  return host(local.DATABASE_URL);
}

/**
 * The E2E branch's URL. Throws if it is missing or points to the same
 * endpoint as .env.local: the seed must never touch production.
 */
export function e2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL;
  const e2eHost = host(url);
  if (!url || !e2eHost) {
    throw new Error(
      "Falta E2E_DATABASE_URL en .env.e2e: la cadena de la rama de Neon del E2E.",
    );
  }
  if (e2eHost === productionHost()) {
    throw new Error(
      "E2E_DATABASE_URL apunta al mismo endpoint que DATABASE_URL de .env.local: el E2E no corre contra producción.",
    );
  }
  return url;
}

/**
 * Environment of the E2E server. Next does not override what is already
 * set, so the empty keys hide the real ones of .env.local: no GitHub, no
 * LLM, no Blob.
 */
export function serverEnv(): Record<string, string> {
  return {
    DATABASE_URL: e2eDatabaseUrl(),
    AUTH_SECRET: E2E_AUTH_SECRET,
    DEMO_USER: E2E_USER,
    DEMO_PASSWORD: E2E_PASSWORD,
    LLM_PROVIDER: "mock",
    LLM_PROVIDER_ORCHESTRATOR: "mock",
    LLM_PROVIDER_DEVELOP: "mock",
    LLM_PROVIDER_TESTING: "mock",
    RUNS_PER_DAY: "5",
    GH_TOKEN: "",
    GH_WEBHOOK_SECRET: "",
    GEMINI_API_KEY: "",
    GROQ_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    BLOB_STORE_ID: "",
    VERCEL_OIDC_TOKEN: "",
  };
}
