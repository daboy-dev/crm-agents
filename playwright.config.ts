import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, serverEnv } from "./e2e/env";

/**
 * E2E of the panel (H7, criterion 6) at 1280 and 390 px, against a local
 * server on the E2E Neon branch. Serial: each test seeds the single active
 * run it needs (D11).
 */
export default defineConfig({
  testDir: "./e2e",
  // Outside the project: next dev watches it, and every trace write would
  // rebuild and reload the page under test (H7).
  outputDir: join(tmpdir(), "crm-agents-e2e"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        storageState: "e2e/.auth/state.json",
      },
    },
    {
      name: "mobile-390",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        storageState: "e2e/.auth/state.json",
      },
    },
  ],
  webServer: {
    // A production build: next dev's HMR reloaded the page under test in
    // a loop and emptied the login form (H7).
    command: `pnpm exec next build && pnpm exec next start --port ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    env: serverEnv(),
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
