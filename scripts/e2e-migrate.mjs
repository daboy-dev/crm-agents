// Applies the migrations to the E2E Neon branch (H7): E2E_DATABASE_URL of
// .env.e2e as DATABASE_URL. drizzle.config.ts does not override it.
import { execSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.e2e", quiet: true });
const url = process.env.E2E_DATABASE_URL;
if (!url) {
  console.error("Falta E2E_DATABASE_URL en .env.e2e.");
  process.exit(1);
}
const local = {};
config({ path: ".env.local", processEnv: local, quiet: true });
const host = (u) => (u ? new URL(u).host : null);
if (host(url) === host(local.DATABASE_URL)) {
  console.error("E2E_DATABASE_URL apunta a producción: no se migra.");
  process.exit(1);
}
execSync("pnpm exec drizzle-kit migrate", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
