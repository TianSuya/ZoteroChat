import { StickyNote, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePanelCopy } from "../ReplyLanguage";
import { Button } from "../components/button";
import type { NoteEditorRequest } from "./noteContext";

/**
 * Small opaque editor anchored near the selected passage. Keeping it inside
 * the panel means it inherits the same tokens as every other floating layer.
 */
export function NoteEditor({
  request,
  onClose,
  onSave,
  onDelete,
}: {
  request: NoteEditorRequest;
  onClose: () => void;
  onSave: (text: string) => void;
  onDelete?: () => void;
}) {
  const copy = usePanelCopy();
  const [text, setText] = useState(request.note?.note ?? "");
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(request.note?.note ?? "");
    textRef.current?.focus();
  }, [request]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose]);

  const position = useMemo(() => {
    const width = 288;
    const height = 220;
    const margin = 8;
    const rect = request.rect;
    if (!rect) {
      return {
        left: Math.max(margin, (window.innerWidth - width) / 2),
        top: Math.max(margin, (window.innerHeight - height) / 2),
      };
    }
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - width - margin),
    );
    const below = rect.bottom + 8;
    const top =
      below + height <= window.innerHeight
        ? below
        : Math.max(margin, rect.top - height - 8);
    return { left, top };
  }, [request.rect]);

  const canSave = text.trim().length > 0;

  return (
    <div
      ref={rootRef}
      className="zc-note-editor zc-float fixed z-30 w-72 rounded-md p-2"
      style={position}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-1 text-xs text-fg-faint">
        <StickyNote size={13} strokeWidth={1.5} />
        <span>{request.note ? copy.noteEditTitle : copy.noteTitle}</span>
      </div>

      <p className="mt-1.5 max-h-20 overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-accent bg-surface-subtle px-2 py-1 text-xs leading-relaxed text-fg-muted">
        {request.quote}
      </p>

      <textarea
        ref={textRef}
        rows={4}
        value={text}
        placeholder={copy.notePlaceholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (canSave) onSave(text.trim());
          }
        }}
        className="mt-1.5 w-full resize-none rounded bg-surface-subtle px-1.5 py-1 text-sm leading-relaxed text-fg outline-none placeholder:text-fg-faint focus-visible:ring-2 focus-visible:ring-accent/40"
      />

      <div className="mt-1.5 flex items-center gap-1">
        <Button
          size="sm"
          variant="primary"
          disabled={!canSave}
          onClick={() => onSave(text.trim())}
        >
          {copy.noteSave}
        </Button>
        <Button size="sm" onClick={onClose}>
          {copy.noteCancel}
        </Button>
        {request.note && onDelete ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-danger hover:text-danger"
            aria-label={copy.noteDelete}
            onClick={onDelete}
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
