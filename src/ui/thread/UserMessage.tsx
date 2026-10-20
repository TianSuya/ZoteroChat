import {
  MessagePrimitive,
  useAuiState,
  useMessagePartText,
} from "@assistant-ui/react";
import { useLayoutEffect, useMemo, useRef } from "react";

import { usePanelCopy } from "../ReplyLanguage";
import { useNoteActions } from "./noteContext";
import { parseUserContent } from "./userContent";
import { wrapNoteMarks } from "./wrapNoteMarks";

/**
 * Notion block, not a bubble: a light fill and a 2px accent rule on the
 * left. A PDF highlight for this turn is shown as a labeled quote.
 */
export function UserMessage() {
  const messageId = useAuiState((s) => s.message.id);
  return (
    <MessagePrimitive.Root
      data-zc-message="user"
      data-zc-message-id={messageId}
      className="group/msg mb-3 rounded-r border-l-2 border-accent bg-surface-subtle py-1.5 pl-2 pr-2"
    >
      <MessagePrimitive.Parts components={{ Text: UserText }} />
    </MessagePrimitive.Root>
  );
}

function UserText() {
  const messageId = useAuiState((s) => s.message.id);
  const { text } = useMessagePartText();
  const copy = usePanelCopy();
  const notes = useNoteActions();
  const noteList = useMemo(
    () => notes?.notesFor(messageId) ?? [],
    [notes, messageId],
  );
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current || !notes) return;
    wrapNoteMarks(ref.current, noteList, (noteId, rect) => {
      const note = noteList.find((item) => item.id === noteId);
      if (note) notes.openExisting(note, rect);
    });
  }, [noteList, notes]);

  const parsed = parseUserContent(text);
  return (
    <div ref={ref} className="flex flex-col gap-1.5">
      {parsed.selection?.text ? (
        <div className="rounded bg-surface px-1.5 py-1">
          <p className="text-xs text-fg-faint">
            {copy.selectionLabel}
            {parsed.selection.page != null
              ? ` · p.${parsed.selection.page}`
              : ""}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-muted">
            {parsed.selection.text}
          </p>
        </div>
      ) : null}
      {parsed.question ? (
        <div className="whitespace-pre-wrap break-words text-base text-fg">
          {parsed.question}
        </div>
      ) : null}
    </div>
  );
}
