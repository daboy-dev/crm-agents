import { describe, expect, it } from "vitest";
import { normalizeContent } from "./files";

describe("normalizeContent (D34)", () => {
  it("uses LF and ends with a newline", () => {
    expect(normalizeContent("a\r\nb\rc")).toBe("a\nb\nc\n");
    expect(normalizeContent("a\n")).toBe("a\n");
    expect(normalizeContent("")).toBe("");
  });
});
