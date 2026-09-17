import { useMessagePartText } from "@assistant-ui/react";
import { useEffect, useMemo, useState } from "react";

import { renderMarkdown } from "./render";
import { SafeHtml } from "./SafeHtml";

/**
 * Assistant text part: markdown-it + KaTeX MathML.
 *
 * Must not use dangerouslySetInnerHTML: the panel is an XHTML document and
 * Firefox throws InvalidCharacterError when MathML hits `innerHTML`.
 *
 * While the token stream is still running, markdown+KaTeX is throttled so a
 * half-open $$ block is not re-parsed on every character.
 */
export function MarkdownText() {
  const part = useMessagePartText();
  const text = part.text;
  const running = part.status.type === "running";
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (!running) {
      setShown(text);
      return;
    }
    const id = window.setTimeout(() => setShown(text), 48);
    return () => window.clearTimeout(id);
  }, [text, running]);

  const html = useMemo(() => renderMarkdown(shown), [shown]);
  return <SafeHtml className="zc-md" html={html} fallback={shown} />;
}
