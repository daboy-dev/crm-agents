import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  checkErrors,
  checkFeedback,
  parseCheck,
  readCheckZip,
  type CheckJson,
} from "./checks";

const X = "e3a0becaaf4d35c0bf4a08ea5f722ccb405bb9e9";
const Y = "4158635c07192d2ab89edcda7cc808e44392ac4e";

// Shape written by crm-demo's pr-check.yml (checked in its PR #11).
const check = (over: Partial<CheckJson> = {}): CheckJson => ({
  sha: Y,
  trigger_sha: X,
  migration_sha: Y,
  ok: false,
  migrate: { ok: true, output: null },
  typecheck: {
    ok: false,
    output:
      "src/lib/money.ts(28,14): error TS2322: Type 'string' is not assignable to type 'number'.\n",
  },
  lint: { ok: true, output: null },
  run_id: 45573247385,
  run_attempt: 1,
  ...over,
});

describe("check.json (D33)", () => {
  it("parses the artifact and keeps only check.json", () => {
    const zip = zipSync({
      "check.json": strToU8(JSON.stringify(check())),
      "other.txt": strToU8("ignored"),
    });
    expect(readCheckZip(zip)).toEqual(check());
  });

  it("rejects a malformed check.json or a missing file", () => {
    expect(() => parseCheck({ ...check(), trigger_sha: "abc" })).toThrow();
    expect(() => readCheckZip(zipSync({ "x.json": strToU8("{}") }))).toThrow(
      "check.json missing",
    );
  });

  it("keeps the output of the failing steps only", () => {
    expect(checkErrors(check())).toEqual({
      migrate: null,
      typecheck: expect.stringContaining("error TS2322"),
      lint: null,
    });
    const long = check({ lint: { ok: false, output: "x".repeat(20_000) } });
    expect(checkErrors(long).lint).toHaveLength(8_000);
  });

  it("writes the feedback Develop reads", () => {
    const text = checkFeedback({
      migrate: "Error: Interactive prompts require a TTY terminal",
      typecheck: "error TS2322",
      lint: null,
    });
    expect(text).toContain("### drizzle-kit generate");
    expect(text).toContain("no renombres ni borres columnas");
    expect(text).toContain("### tsc --noEmit\nerror TS2322");
    expect(text).not.toContain("ESLint");
    expect(checkFeedback(null)).toContain("No dejó check.json");
  });
});
