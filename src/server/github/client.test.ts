import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadArtifact, findRunArtifact } from "./client";

const artifact = {
  id: 1,
  name: "e2e-results",
  size_in_bytes: 1000,
  expired: false,
  archive_download_url:
    "https://api.github.com/repos/daboy-dev/crm-demo/actions/artifacts/1/zip",
};

describe("GitHub artifacts", () => {
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

  it("finds the named, unexpired artifact of a run", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        artifacts: [{ ...artifact, id: 0, expired: true }, artifact],
      }),
    );
    expect(await findRunArtifact(42, "e2e-results")).toEqual(artifact);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.github.com/repos/daboy-dev/crm-demo/actions/runs/42/artifacts?name=e2e-results",
    );
  });

  it("follows the redirect without sending the token to the signed URL", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://blob.test/signed" },
        }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));

    expect(await downloadArtifact(artifact)).toEqual(new Uint8Array([1, 2, 3]));
    const [, first] = fetchMock.mock.calls[0] ?? [];
    expect(first?.redirect).toBe("manual");
    expect(new Headers(first?.headers).get("authorization")).toBe(
      "Bearer test-token",
    );
    const [signedUrl, second] = fetchMock.mock.calls[1] ?? [];
    expect(signedUrl).toBe("https://blob.test/signed");
    expect(new Headers(second?.headers).get("authorization")).toBeNull();
  });

  it("refuses an oversized artifact before downloading", async () => {
    await expect(
      downloadArtifact({ ...artifact, size_in_bytes: 100 * 1024 * 1024 }),
    ).rejects.toThrow(/too large/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
