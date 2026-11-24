import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runIdFromBranch } from "./config";
import {
  createBranch,
  createTree,
  deleteBranch,
  findOpenPr,
  getBranchSha,
  GitHubError,
  mergePr,
  moveBranch,
} from "./repo";

const pr = (over: object = {}) => ({
  number: 9,
  html_url: "https://github.com/daboy-dev/crm-demo/pull/9",
  state: "open",
  merged: false,
  head: { sha: "abc", ref: "run/7" },
  ...over,
});

describe("GitHub repo client", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const lastCall = () => fetchMock.mock.calls.at(-1)!;

  beforeEach(() => {
    vi.stubEnv("GH_TOKEN", "test-token");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("reads a branch sha and returns null for a missing branch", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ object: { sha: "s1" } }));
    expect(await getBranchSha("run/7")).toBe("s1");
    expect(String(lastCall()[0])).toBe(
      "https://api.github.com/repos/daboy-dev/crm-demo/git/ref/heads/run/7",
    );
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect(await getBranchSha("run/8")).toBeNull();
  });

  it("builds a tree with complete files on top of the base tree", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ sha: "t1" }, { status: 201 }),
    );
    expect(await createTree("base", [{ path: "a.md", content: "x" }])).toBe(
      "t1",
    );
    const body = JSON.parse(String(lastCall()[1]?.body));
    expect(body).toEqual({
      base_tree: "base",
      tree: [{ path: "a.md", mode: "100644", type: "blob", content: "x" }],
    });
  });

  it("treats an existing branch as not created", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 422 }));
    expect(await createBranch("run/7", "s")).toBe(false);
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 201 }));
    expect(await createBranch("run/7", "s")).toBe(true);
  });

  it("never force-moves a branch", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({}));
    await moveBranch("run/7", "s2");
    expect(lastCall()[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(lastCall()[1]?.body))).toEqual({
      sha: "s2",
      force: false,
    });
  });

  it("fails when GitHub refuses a fast-forward", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 422 }));
    await expect(moveBranch("run/7", "s2")).rejects.toBeInstanceOf(GitHubError);
  });

  it("deleting a branch that is gone succeeds", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 422 }));
    await expect(deleteBranch("run/7")).resolves.toBeUndefined();
  });

  it("finds the open PR of the run branch", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([pr()]));
    expect(await findOpenPr("run/7")).toMatchObject({
      number: 9,
      headSha: "abc",
    });
    expect(String(lastCall()[0])).toContain("head=daboy-dev%3Arun%2F7");
    fetchMock.mockResolvedValueOnce(Response.json([]));
    expect(await findOpenPr("run/7")).toBeNull();
  });

  it("squash-merges pinned to the head sha", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ merged: true }));
    expect(await mergePr(9, "abc", "Run #7")).toBe("merged");
    expect(JSON.parse(String(lastCall()[1]?.body))).toEqual({
      merge_method: "squash",
      sha: "abc",
      commit_title: "Run #7",
    });
  });

  it("a PR merged earlier counts as merged", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 405 }))
      .mockResolvedValueOnce(
        Response.json(pr({ state: "closed", merged: true })),
      );
    expect(await mergePr(9, "abc", "Run #7")).toBe("already_merged");
  });

  it("a moved head is not mergeable", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 409 }))
      .mockResolvedValueOnce(Response.json(pr()));
    expect(await mergePr(9, "old", "Run #7")).toBe("not_mergeable");
  });

  it("server errors throw", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 502 }));
    await expect(getBranchSha("run/7")).rejects.toThrow("HTTP 502");
  });
});

describe("runIdFromBranch", () => {
  it.each([
    ["run/7", 7],
    ["run/123", 123],
    ["run/7/x", null],
    ["feature/run/7", null],
    [null, null],
  ] as const)("%s → %s", (branch, id) => {
    expect(runIdFromBranch(branch)).toBe(id);
  });
});
