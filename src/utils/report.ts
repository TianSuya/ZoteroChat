/**
 * Logging that works on both sides of the iframe boundary.
 *
 * The panel document has no `ztoolkit`, but it is same-process chrome, so
 * `Zotero.debug` is reachable through the parent window when present.
 */
export function report(...args: unknown[]) {
  const text = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  try {
    const zot = (globalThis as any).Zotero ?? (window.parent as any)?.Zotero;
    zot?.debug?.(`[ZoteroChat] ${text}`);
  } catch {
    // Nothing to log to; stay silent rather than break the render path.
  }
}
