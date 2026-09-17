/**
 * The panel document is XHTML. Assigning to `innerHTML` there uses the XML
 * parser, which throws InvalidCharacterError ("An invalid or illegal string
 * was specified") on KaTeX MathML — unknown entities, unescaped `&` in
 * TeX annotations, namespaced `<math>`.
 *
 * Parse as HTML in a detached document, then import nodes into the panel.
 */
export function setHtmlContent(target: HTMLElement, html: string): void {
  if (!html) {
    target.replaceChildren();
    return;
  }
  const parsed = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    "text/html",
  );
  const dest = target.ownerDocument;
  const frag = dest.createDocumentFragment();
  // importNode copies — it does not detach. Iterating firstChild without
  // removing would clone forever and exhaust RAM (observed >70GB).
  for (const node of Array.from(parsed.body.childNodes)) {
    if (!node) continue;
    frag.appendChild(dest.importNode(node, true));
  }
  target.replaceChildren(frag);
}
