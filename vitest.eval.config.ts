import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** `pnpm eval:plan`: real Gemini calls, by hand only, never in CI (D30). */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["scripts/**/*.eval.ts"],
    testTimeout: 10 * 60_000,
    fileParallelism: false,
  },
});
