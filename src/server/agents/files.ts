/**
 * Contents as the panel commits them (D34): LF line endings and a final
 * newline. Develop's output and the current files are compared this way.
 */
export function normalizeContent(text: string): string {
  const lf = text.replace(/\r\n?/g, "\n");
  return lf === "" || lf.endsWith("\n") ? lf : `${lf}\n`;
}
