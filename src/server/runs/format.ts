import { format } from "prettier";

/**
 * Formats a file of Develop's answer like `pnpm format` in crm-demo (D41), so
 * merged runs keep its `format:check` green. Prettier runs here on the text,
 * with crm-demo's options (`.prettierrc.json` is `{}`), and never reads a
 * config from the branch: a `prettier.config.mjs` written by Develop would be
 * code. Same version as crm-demo's lockfile (package.json pins it).
 */

/** What crm-demo's .prettierignore leaves out, plus what Prettier can't read. */
const FORMATTED = /\.(ts|tsx|js|jsx|mjs|cjs|json|css)$/;
const IGNORED = [
  /^drizzle\/meta\//,
  /^e2e\/criteria\//,
  /(^|\/)pnpm-lock\.yaml$/,
];

export const isFormatted = (path: string) =>
  FORMATTED.test(path) && !IGNORED.some((re) => re.test(path));

export type Formatted = { content: string; error: string | null };

/**
 * The formatted content, or the content as it is when Prettier cannot parse
 * it: then the file has a syntax error that pr-check reports to Develop.
 */
export async function formatFile(
  path: string,
  content: string,
): Promise<Formatted> {
  if (!isFormatted(path)) return { content, error: null };
  try {
    return { content: await format(content, { filepath: path }), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content, error: message.split("\n")[0]!.slice(0, 300) };
  }
}
