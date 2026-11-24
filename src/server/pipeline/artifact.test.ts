import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  cleanError,
  parseMeta,
  parseResults,
  readArtifactZip,
} from "./artifact";

const results = JSON.parse(
  readFileSync(new URL("./fixtures/results.json", import.meta.url), "utf8"),
) as unknown;

const meta = {
  sha: "6c2bb79bba387eb6724303d924bcc8d4f867607c",
  ref: "ci/preview-e2e",
  target_url: "https://crm-demo-abc123-daboy-dev.vercel.app",
  run_id: 45403048280,
  run_attempt: 1,
};

describe("parseResults", () => {
  it("counts every status and lists the failing tests", () => {
    expect(parseResults(results)).toEqual({
      passed: 2,
      failed: 1,
      flaky: 1,
      skipped: 1,
      durationMs: 46710,
      failures: [
        {
          title: "smoke.spec.ts › lists clients, quotes and invoices with data",
          project: "desktop",
          error:
            "Error: expect(locator).toBeVisible() failed\n\nLocator: getByTestId('client-row')",
        },
      ],
    });
  });

  it("includes describe blocks in the title", () => {
    const report = {
      suites: [
        {
          title: "a.spec.ts",
          suites: [
            {
              title: "group",
              specs: [
                {
                  title: "breaks",
                  tests: [
                    {
                      projectName: "mobile-390",
                      status: "unexpected",
                      results: [{ status: "failed", errors: [] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      stats: { duration: 1 },
    };
    expect(parseResults(report).failures[0]).toEqual({
      title: "a.spec.ts › group › breaks",
      project: "mobile-390",
      error: "",
    });
  });

  it("counts errors outside tests as failures", () => {
    const summary = parseResults({
      suites: [],
      errors: [{ message: "SyntaxError: Unexpected token" }],
      stats: { duration: 10 },
    });
    expect(summary.failed).toBe(1);
    expect(summary.failures[0]?.error).toBe("SyntaxError: Unexpected token");
  });

  it("rejects something that is not a Playwright report", () => {
    expect(() => parseResults({ tests: [] })).toThrow();
  });
});

describe("parseMeta", () => {
  it("accepts the workflow's meta.json", () => {
    expect(parseMeta(meta)).toEqual(meta);
  });

  it.each([
    { ...meta, sha: "abc" },
    { ...meta, run_id: "45403048280" },
    { sha: meta.sha },
  ])("rejects %j", (value) => {
    expect(() => parseMeta(value)).toThrow();
  });
});

describe("cleanError", () => {
  it("strips colours and caps the length", () => {
    expect(cleanError("\u001b[31mboom\u001b[39m")).toBe("boom");
    expect(cleanError("x".repeat(900))).toHaveLength(500);
    expect(cleanError(undefined)).toBe("");
  });
});

describe("readArtifactZip", () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

  it("extracts meta, results and the screenshots", () => {
    const zip = zipSync({
      "meta.json": strToU8(JSON.stringify(meta)),
      "results.json": strToU8(JSON.stringify(results)),
      "screenshots/clientes-390.jpg": jpg,
      "screenshots/clientes-1280.jpg": jpg,
      "screenshots/facturas-1280.jpg": jpg,
      "screenshots/notes.txt": strToU8("ignored"),
      "screenshots/../evil-1280.jpg": jpg,
      "screenshots/Clientes-800.jpg": jpg,
    });
    const artifact = readArtifactZip(zip);
    expect(artifact.meta).toEqual(meta);
    expect(artifact.results.failed).toBe(1);
    expect(
      artifact.screenshots.map(({ page, width }) => `${page}-${width}`),
    ).toEqual(["clientes-1280", "clientes-390", "facturas-1280"]);
    expect(artifact.screenshots[0]?.data).toEqual(jpg);
  });

  it("fails when results.json is missing", () => {
    const zip = zipSync({ "meta.json": strToU8(JSON.stringify(meta)) });
    expect(() => readArtifactZip(zip)).toThrow(/results.json missing/);
  });
});
