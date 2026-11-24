import { z } from "zod";
import { API, headers } from "./client";
import { BASE_BRANCH, DEMO_REPO } from "./config";

/**
 * Git Data and pull request calls on crm-demo (D3, D20). Every function is
 * safe to repeat: callers check state first and treat "already done"
 * answers as success.
 */

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`GitHub ${path}: HTTP ${status} ${body.slice(0, 200)}`);
  }
}

async function call(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${API}/repos/${DEMO_REPO}${path}`, {
    method,
    headers: {
      ...headers(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok && ![404, 405, 409, 422].includes(res.status)) {
    throw new GitHubError(res.status, path, text);
  }
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function expectOk(
  r: { status: number; json: unknown },
  path: string,
  ok = [200, 201],
) {
  if (!ok.includes(r.status)) {
    throw new GitHubError(r.status, path, JSON.stringify(r.json));
  }
  return r.json;
}

const shaObject = z.object({ sha: z.string() });

/** Sha the branch points to, or null when it does not exist. */
export async function getBranchSha(branch: string): Promise<string | null> {
  const path = `/git/ref/heads/${branch}`;
  const r = await call("GET", path);
  if (r.status === 404) return null;
  return z.object({ object: shaObject }).parse(expectOk(r, path)).object.sha;
}

export const getBaseSha = async () => {
  const sha = await getBranchSha(BASE_BRANCH);
  if (!sha) throw new Error(`${BASE_BRANCH} not found in ${DEMO_REPO}`);
  return sha;
};

export async function getCommitTree(sha: string): Promise<string> {
  const path = `/git/commits/${sha}`;
  const r = await call("GET", path);
  return z.object({ tree: shaObject }).parse(expectOk(r, path)).tree.sha;
}

export type FileWrite = { path: string; content: string };

/** New tree on top of baseTree with the given complete files. */
export async function createTree(
  baseTree: string,
  files: FileWrite[],
): Promise<string> {
  const path = "/git/trees";
  const r = await call("POST", path, {
    base_tree: baseTree,
    tree: files.map((f) => ({
      path: f.path,
      mode: "100644",
      type: "blob",
      content: f.content,
    })),
  });
  return shaObject.parse(expectOk(r, path)).sha;
}

export async function createCommit(input: {
  message: string;
  tree: string;
  parent: string;
}): Promise<string> {
  const path = "/git/commits";
  const r = await call("POST", path, {
    message: input.message,
    tree: input.tree,
    parents: [input.parent],
  });
  return shaObject.parse(expectOk(r, path)).sha;
}

/** Creates the branch. Returns false when it already exists. */
export async function createBranch(branch: string, sha: string) {
  const path = "/git/refs";
  const r = await call("POST", path, { ref: `refs/heads/${branch}`, sha });
  if (r.status === 422) return false;
  expectOk(r, path);
  return true;
}

/** Fast-forwards the branch (force: false). */
export async function moveBranch(branch: string, sha: string) {
  const path = `/git/refs/heads/${branch}`;
  expectOk(await call("PATCH", path, { sha, force: false }), path);
}

/** Deletes the branch; a branch that is already gone counts as deleted. */
export async function deleteBranch(branch: string) {
  const path = `/git/refs/heads/${branch}`;
  const r = await call("DELETE", path);
  if (![204, 404, 422].includes(r.status)) {
    throw new GitHubError(r.status, path, JSON.stringify(r.json));
  }
}

const prSchema = z.object({
  number: z.number().int(),
  html_url: z.string(),
  state: z.enum(["open", "closed"]),
  merged: z.boolean().nullish(),
  head: z.object({ sha: z.string(), ref: z.string() }),
});
export type PullRequest = {
  number: number;
  url: string;
  state: "open" | "closed";
  merged: boolean;
  headSha: string;
};
const toPr = (p: z.infer<typeof prSchema>): PullRequest => ({
  number: p.number,
  url: p.html_url,
  state: p.state,
  merged: p.merged ?? false,
  headSha: p.head.sha,
});

export async function findOpenPr(branch: string): Promise<PullRequest | null> {
  const owner = DEMO_REPO.split("/")[0];
  const path = `/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`;
  const list = z.array(prSchema).parse(expectOk(await call("GET", path), path));
  const pr = list.find((p) => p.head.ref === branch);
  return pr ? toPr(pr) : null;
}

export async function createPr(input: {
  branch: string;
  title: string;
  body: string;
}): Promise<PullRequest> {
  const path = "/pulls";
  const r = await call("POST", path, {
    head: input.branch,
    base: BASE_BRANCH,
    title: input.title,
    body: input.body,
  });
  return toPr(prSchema.parse(expectOk(r, path)));
}

export async function getPr(number: number): Promise<PullRequest> {
  const path = `/pulls/${number}`;
  return toPr(prSchema.parse(expectOk(await call("GET", path), path)));
}

export type MergeResult = "merged" | "already_merged" | "not_mergeable";

/**
 * Squash merge pinned to the expected head sha: GitHub
 * refuses it if the branch moved. A PR merged earlier counts as merged.
 */
export async function mergePr(
  number: number,
  sha: string,
  title: string,
): Promise<MergeResult> {
  const path = `/pulls/${number}/merge`;
  const r = await call("PUT", path, {
    merge_method: "squash",
    sha,
    commit_title: title,
  });
  if (r.status === 200) return "merged";
  const pr = await getPr(number);
  if (pr.merged) return "already_merged";
  if ([405, 409, 422].includes(r.status)) return "not_mergeable";
  throw new GitHubError(r.status, path, JSON.stringify(r.json));
}

export async function closePr(number: number) {
  const path = `/pulls/${number}`;
  expectOk(await call("PATCH", path, { state: "closed" }), path);
}

const treeSchema = z.object({
  truncated: z.boolean(),
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});

/** Every file path of the repo at a commit (Git Trees API, recursive; D27). */
export async function getFilePaths(sha: string): Promise<string[]> {
  const path = `/git/trees/${sha}?recursive=1`;
  const tree = treeSchema.parse(expectOk(await call("GET", path), path));
  return tree.tree.filter((e) => e.type === "blob").map((e) => e.path);
}

const contentSchema = z.object({
  encoding: z.literal("base64"),
  content: z.string(),
});

/** Text of a file at a commit, or null when it does not exist there. */
export async function getFileText(
  file: string,
  sha: string,
): Promise<string | null> {
  const path = `/contents/${file.split("/").map(encodeURIComponent).join("/")}?ref=${sha}`;
  const r = await call("GET", path);
  if (r.status === 404) return null;
  const { content } = contentSchema.parse(expectOk(r, path));
  return Buffer.from(content, "base64").toString("utf8");
}
