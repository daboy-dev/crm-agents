import { z } from "zod";
import { DEMO_REPO } from "./config";

const API = "https://api.github.com";
const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;

function token(): string {
  const value = process.env.GH_TOKEN;
  if (!value) throw new Error("GH_TOKEN is not set");
  return value;
}

function headers(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token()}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "crm-agents",
  };
}

const artifactsSchema = z.object({
  artifacts: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      size_in_bytes: z.number(),
      expired: z.boolean(),
      archive_download_url: z.string(),
    }),
  ),
});
export type RunArtifact = z.infer<typeof artifactsSchema>["artifacts"][number];

/** Finds a named artifact of a crm-demo workflow run (PAT with Actions: read, D16). */
export async function findRunArtifact(
  runId: number,
  name: string,
): Promise<RunArtifact | null> {
  const url = `${API}/repos/${DEMO_REPO}/actions/runs/${runId}/artifacts?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub artifacts list: HTTP ${res.status}`);
  const { artifacts } = artifactsSchema.parse(await res.json());
  return artifacts.find((a) => a.name === name && !a.expired) ?? null;
}

/**
 * Downloads an artifact zip. GitHub answers with a redirect to a short-lived
 * signed URL, which is fetched without the token and never stored or logged.
 */
export async function downloadArtifact(
  artifact: RunArtifact,
): Promise<Uint8Array> {
  if (artifact.size_in_bytes > MAX_ARTIFACT_BYTES) {
    throw new Error(`Artifact too large: ${artifact.size_in_bytes} bytes`);
  }
  const res = await fetch(artifact.archive_download_url, {
    headers: headers(),
    redirect: "manual",
    cache: "no-store",
  });
  const location = res.headers.get("location");
  if (res.status !== 302 || !location) {
    throw new Error(`GitHub artifact download: HTTP ${res.status}`);
  }
  const zip = await fetch(location, { cache: "no-store" });
  if (!zip.ok) throw new Error(`Artifact zip: HTTP ${zip.status}`);
  return new Uint8Array(await zip.arrayBuffer());
}
