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
 * «Simular fallo de criterio» (D40): renames one literal data-testid in the
 * files, so the criterion that needs it fails on the preview. Returns null
 * when the testId is not written literally in any file.
 */
export function breakTestId<T extends { path: string; content: string }>(
  files: readonly T[],
  testIds: readonly string[],
): { testId: string; files: T[] } | null {
  for (const testId of testIds) {
    const literal = `data-testid="${testId}"`;
    if (!files.some((f) => f.content.includes(literal))) continue;
    return {
      testId,
      files: files.map((f) => ({
        ...f,
        content: f.content.replaceAll(
          literal,
          `data-testid="${testId}-simulated"`,
        ),
      })),
    };
  }
  return null;
}
