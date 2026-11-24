import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPlanContext } from "./context";

describe("readPlanContext (D27)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubEnv("GH_TOKEN", "test-token");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("reads the tree and the context files at the base sha", async () => {
    const b64 = (s: string) => Buffer.from(s).toString("base64");
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/git/trees/")) {
        return Response.json({
          truncated: false,
          tree: [
            { path: "AGENTS.md", type: "blob" },
            { path: "src", type: "tree" },
            { path: "src/db/schema.ts", type: "blob" },
            { path: "agent-runs/7/task-1.md", type: "blob" },
          ],
        });
      }
      const file = decodeURIComponent(
        url.split("/contents/")[1]!.split("?")[0]!,
      );
      return Response.json({ encoding: "base64", content: b64(`# ${file}`) });
    });

    const ctx = await readPlanContext("base1");
    expect(ctx.tree).toEqual(["AGENTS.md", "src/db/schema.ts"]);
    // e2e/pages.ts is not in this tree, so it is not requested.
    expect(ctx.files).toEqual([
      { path: "AGENTS.md", content: "# AGENTS.md" },
      { path: "src/db/schema.ts", content: "# src/db/schema.ts" },
    ]);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toBe(
      "https://api.github.com/repos/daboy-dev/crm-demo/git/trees/base1?recursive=1",
    );
    expect(urls.slice(1).every((u) => u.endsWith("?ref=base1"))).toBe(true);
  });
});
