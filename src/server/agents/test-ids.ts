/**
 * Whether the code uses a data-testid (D38). crm-demo builds some of them:
 * `<Field name="x">` renders `field-x`, the line items `item-${i}-<field>` and
 * the nav links `nav-<href>`. A quick textual check, not a parser: the
 * criteria runner on the preview is what really decides.
 */
export function usesTestId(testId: string, texts: readonly string[]): boolean {
  const quoted = (value: string) =>
    texts.some(
      (t) =>
        t.includes(`"${value}"`) ||
        t.includes(`'${value}'`) ||
        t.includes(`\`${value}\``),
    );
  if (quoted(testId)) return true;
  const field = /^field-(.+)$/.exec(testId);
  if (field && quoted(field[1]!)) return true;
  const item = /^item-[0-9]+-(.+)$/.exec(testId);
  if (item && texts.some((t) => t.includes(`-${item[1]}`))) return true;
  const nav = /^nav-(.+)$/.exec(testId);
  if (nav && quoted(`/${nav[1]}`)) return true;
  return false;
}

/**
 * «Simular fallo de criterio» (D40): renames one quoted data-testid in the
 * files, so the criterion that needs it fails on the preview. Only one this
 * change adds: renaming one that `before` (the files as they were) already
 * had would break older tests too (run #21). Returns null when no new
 * testId is written literally.
 */
export function breakTestId<T extends { path: string; content: string }>(
  files: readonly T[],
  testIds: readonly string[],
  before: readonly string[] = [],
): { testId: string; files: T[] } | null {
  for (const testId of testIds) {
    // data-testid="x", testId: "x" (PageHeader's items, run #21) or 'x'.
    const quoted = new RegExp(`(["'\`])${testId}\\1`, "g");
    const has = (content: string) => new RegExp(quoted).test(content);
    if (!files.some((f) => has(f.content))) continue;
    if (before.some(has)) continue;
    return {
      testId,
      files: files.map((f) => ({
        ...f,
        content: f.content.replace(quoted, `$1${testId}-simulated$1`),
      })),
    };
  }
  return null;
}
