import { useLayoutEffect, useRef } from "react";

import { report } from "../../utils/report";
import { setHtmlContent } from "./setHtml";

export function SafeHtml({
  html,
  fallback,
  className,
  onReady,
}: {
  html: string;
  fallback: string;
  className?: string;
  onReady?: (node: HTMLElement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    try {
      setHtmlContent(node, html);
    } catch (err) {
      report("markdown inject failed", String(err));
      node.textContent = fallback;
    }
    onReady?.(node);
  }, [html, fallback, onReady]);

  return <div ref={ref} className={className} />;
}
