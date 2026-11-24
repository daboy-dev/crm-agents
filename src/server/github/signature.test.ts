import { describe, expect, it } from "vitest";
import { signGithubPayload, verifyGithubSignature } from "./signature";

const SECRET = "webhook-secret";
const BODY = JSON.stringify({ zen: "Keep it logically awesome." });

describe("verifyGithubSignature", () => {
  it("accepts a valid signature", () => {
    expect(
      verifyGithubSignature(BODY, signGithubPayload(BODY, SECRET), SECRET),
    ).toBe(true);
  });

  it("matches GitHub's documented example", () => {
    // https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
    expect(
      verifyGithubSignature(
        "Hello, World!",
        "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17",
        "It's a Secret to Everybody",
      ),
    ).toBe(true);
  });

  it("rejects another secret or a modified body", () => {
    const header = signGithubPayload(BODY, SECRET);
    expect(verifyGithubSignature(BODY, header, "other")).toBe(false);
    expect(verifyGithubSignature(`${BODY} `, header, SECRET)).toBe(false);
  });

  it.each([null, "", "sha1=abc", "sha256=", "sha256=zz", "sha256=abcd"])(
    "rejects malformed header %j",
    (header) => {
      expect(verifyGithubSignature(BODY, header, SECRET)).toBe(false);
    },
  );

  it("rejects everything without a secret", () => {
    expect(verifyGithubSignature(BODY, signGithubPayload(BODY, ""), "")).toBe(
      false,
    );
  });
});
