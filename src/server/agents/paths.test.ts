import { describe, expect, it } from "vitest";
import { checkPaths, normalizePath } from "./paths";

describe("checkPaths", () => {
  it.each([
    "agent-runs/7/task-1.md",
    "src/app/clientes/page.tsx",
    "e2e/nif.spec.ts",
    "e2e/pages.ts",
    "src/db/schema.ts",
  ])("allows %s", (path) => {
    expect(checkPaths([path])).toEqual({ ok: true });
  });

  it.each([
    ".github/workflows/agent.yml",
    ".GitHub/workflows/ci.yml",
    "e2e/helpers.ts",
    "e2e/screenshots.spec.ts",
    "drizzle/0005_nif.sql",
    "drizzle/meta/_journal.json",
    "package.json",
    "pnpm-lock.yaml",
    "drizzle.config.ts",
    "tsconfig.json",
    "eslint.config.mjs",
  ])("rejects %s", (path) => {
    const result = checkPaths(["agent-runs/7/task-1.md", path]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.path).toBe(path);
  });

  it.each([
    "/etc/passwd",
    "../crm-agents/x",
    "a//b",
    "./a",
    "a\\b",
    "src/../.github/x",
  ])("rejects the invalid path %s", (path) => {
    expect(checkPaths([path]).ok).toBe(false);
    expect(normalizePath(path)).toBeNull();
  });

  it("rejects repeated paths", () => {
    expect(checkPaths(["a.md", "a.md"]).ok).toBe(false);
  });
});
