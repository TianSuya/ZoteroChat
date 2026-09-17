/**
 * Byte-stable text cleanup. The frozen paper prefix is this function's
 * output; if it is not idempotent, every extract is a cache miss.
 */
export function normalize(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
