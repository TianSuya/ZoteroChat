import {
  ActionBarPrimitive,
  AuiIf,
  MessagePrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { Check, Copy, MessageSquareQuote } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "../components/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { MarkdownText } from "../markdown/MarkdownText";
import { usePanelCopy } from "../ReplyLanguage";
import { excerptQuote, useAsideActions } from "./asideContext";
import { wrapAsideQuotes } from "./wrapAsideQuotes";

/**
 * Assistant copy is naked body text. Actions hover-reveal, except on the
 * last message where ChatGPT keeps them reachable without hunting.
 *
 * Edit / branch / delete are omitted on purpose — the runtime does not
 * advertise those capabilities (ADR 0004).
 */
function AssistantMarkdown() {
  const aside = useAsideActions();
  const messageId = useAuiState((s) => s.message.id);
  const onReady = useCallback(
    (node: HTMLElement) => {
      if (!aside) return;
      wrapAsideQuotes(
        node,
        aside.markersFor(messageId).filter((m) => m.fromSelection),
        aside.onOpen,
      );
    },
    [aside, messageId],
  );
  return <MarkdownText onReady={onReady} />;
}

export function AssistantMessage() {
  const aside = useAsideActions();
  return (
    <MessagePrimitive.Root
      data-zc-message="assistant"
      className="group/msg relative mb-4"
    >
      <AssistantBody aside={aside} />
    </MessagePrimitive.Root>
  );
}

function AssistantBody({
  aside,
}: {
  aside: ReturnType<typeof useAsideActions>;
}) {
  const copy = usePanelCopy();
  const messageId = useAuiState((s) => s.message.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);

  const quoteFromMessage = useCallback(() => {
    const sel = window.getSelection();
    const selected = sel?.toString().trim() ?? "";
    if (
      selected &&
      sel &&
      sel.rangeCount > 0 &&
      rootRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)
    ) {
      return excerptQuote(selected);
    }
    return excerptQuote(rootRef.current?.innerText ?? "");
  }, []);

  const onMouseUp = () => {
    if (!aside) {
      setToolbar(null);
      return;
    }
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (
      !text ||
      !sel ||
      sel.rangeCount === 0 ||
      !rootRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)
    ) {
      setToolbar(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const root = rootRef.current.getBoundingClientRect();
    setToolbar({
      text: excerptQuote(text),
      top: rect.bottom - root.top + 8,
      left: Math.min(
        Math.max(0, rect.left - root.left),
        Math.max(0, root.width - 168),
      ),
    });
  };

  const markers = aside?.markersFor(messageId) ?? [];

  return (
    <>
      <div
        ref={rootRef}
        className="relative text-base text-fg"
        onMouseUp={onMouseUp}
      >
        <MessagePrimitive.Parts components={{ Text: AssistantMarkdown }} />
        <AuiIf
          condition={(s) => Boolean(s.thread.isRunning && s.message.isLast)}
        >
          <span className="zc-caret" aria-hidden="true" />
        </AuiIf>
        {toolbar && aside ? (
          <div
            className="absolute z-20"
            style={{ top: toolbar.top, left: toolbar.left }}
          >
            <button
              type="button"
              className="zc-ask-aside-chip"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                aside.onAsk(messageId, toolbar.text, "selection");
                setToolbar(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              <MessageSquareQuote size={14} strokeWidth={1.5} />
              {copy.askAside}
            </button>
          </div>
        ) : null}
      </div>

      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        className="mt-1 flex items-center gap-0.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ActionBarPrimitive.Copy asChild>
              <Button size="icon" aria-label={copy.copy}>
                <Copy size={14} strokeWidth={1.5} className="zc-copy-icon" />
                <Check size={14} strokeWidth={1.5} className="zc-copied-icon" />
              </Button>
            </ActionBarPrimitive.Copy>
          </TooltipTrigger>
          <TooltipContent>{copy.copy}</TooltipContent>
        </Tooltip>
        {aside ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                aria-label={copy.askAside}
                onClick={() => {
                  const quote = quoteFromMessage();
                  if (quote) aside.onAsk(messageId, quote, "message");
                }}
              >
                <MessageSquareQuote size={14} strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copy.askAside}</TooltipContent>
          </Tooltip>
        ) : null}
      </ActionBarPrimitive.Root>
      {aside && markers.length === 1 ? (
        <Button
          size="sm"
          className="mt-0.5 h-6 px-1.5 text-xs text-fg-muted"
          onClick={() => aside.onOpen(markers[0]!.id)}
        >
          {copy.askAside} · 1
        </Button>
      ) : null}
      {aside && markers.length > 1 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              className="mt-0.5 h-6 px-1.5 text-xs text-fg-muted"
            >
              {copy.askAside} · {markers.length}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            {markers.map((m) => (
              <button
                key={m.id}
                type="button"
                className="zc-float-item block w-full rounded px-1.5 py-1 text-left text-sm"
                onClick={() => aside.onOpen(m.id)}
              >
                {excerptQuote(m.quote, 80)}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );
}
