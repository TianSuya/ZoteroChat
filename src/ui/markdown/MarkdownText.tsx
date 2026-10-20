import { useMessagePartText } from "@assistant-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { renderMarkdown } from "./render";
import { SafeHtml } from "./SafeHtml";

/**
 * Assistant text part: markdown-it + KaTeX MathML.
 *
 * Must not use dangerouslySetInnerHTML: the panel is an XHTML document and
 * Firefox throws InvalidCharacterError when MathML hits `innerHTML`.
 *
 * While the token stream is still running, markdown+KaTeX is throttled to
 * roughly one render per 48ms. A debounce would stall indefinitely while
 * tokens arrive faster than the timeout.
 */
export function MarkdownText({
  onReady,
}: {
  onReady?: (node: HTMLElement) => void;
} = {}) {
  const part = useMessagePartText();
  const text = part.text;
  const running = part.status.type === "running";
  const latest = useRef(text);
  latest.current = text;
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (!running) {
      setShown(latest.current);
      return;
    }
    const id = window.setInterval(() => setShown(latest.current), 48);
    return () => window.clearInterval(id);
  }, [running]);

  const html = useMemo(() => renderMarkdown(shown), [shown]);
  return (
    <SafeHtml
      className="zc-md"
      html={html}
      fallback={shown}
      onReady={onReady}
    />
  );
}
