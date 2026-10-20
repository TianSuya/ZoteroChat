import { MessageSquareQuote, StickyNote } from "lucide-react";
import { useEffect, useState } from "react";

import { usePanelCopy } from "../ReplyLanguage";
import { excerptQuote, useAsideActions } from "./asideContext";
import { useNoteActions, type RectLike } from "./noteContext";

type MenuState = {
  text: string;
  messageId: string;
  role: "user" | "assistant";
  rect: RectLike;
};

function rectOfRange(range: Range): RectLike {
  const rect = range.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * One floating action strip for any selection inside the main thread.
 *
 * It reads the enclosing message from `data-zc-message-id`, so the same code
 * handles user and assistant messages and does not need a copy per component.
 */
export function SelectionLayer() {
  const copy = usePanelCopy();
  const aside = useAsideActions();
  const notes = useNoteActions();
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    const hide = () => setMenu(null);

    const onMouseUp = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".zc-selection-menu"))
        return;

      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (!text || !selection || selection.rangeCount === 0) {
        hide();
        return;
      }

      const anchor = selection.anchorNode;
      const anchorEl =
        anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
      const messageEl = anchorEl?.closest(
        "[data-zc-message-id]",
      ) as HTMLElement | null;
      if (!messageEl || !messageEl.closest('[data-zc-thread="main"]')) {
        hide();
        return;
      }
      const messageId = messageEl.dataset.zcMessageId;
      if (!messageId) {
        hide();
        return;
      }
      const role =
        messageEl.dataset.zcMessage === "assistant" ? "assistant" : "user";
      setMenu({
        text,
        messageId,
        role,
        rect: rectOfRange(selection.getRangeAt(0)),
      });
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  if (!menu) return null;
  const canAsk = menu.role === "assistant" && Boolean(aside);
  const canNote = Boolean(notes);
  if (!canAsk && !canNote) return null;

  const width = 190;
  const margin = 8;
  const left = Math.min(
    Math.max(margin, menu.rect.left),
    Math.max(margin, window.innerWidth - width - margin),
  );
  const below = menu.rect.bottom + 6;
  const top =
    below + 34 <= window.innerHeight
      ? below
      : Math.max(margin, menu.rect.top - 36);

  const clear = () => {
    window.getSelection()?.removeAllRanges();
    setMenu(null);
  };

  return (
    <div
      className="zc-selection-menu zc-float fixed z-30 flex items-center gap-0.5 rounded p-0.5"
      style={{ top, left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {canNote ? (
        <button
          type="button"
          className="zc-selection-action"
          onClick={() => {
            notes?.openNew(menu.messageId, menu.text, menu.rect);
            clear();
          }}
        >
          <StickyNote size={13} strokeWidth={1.5} />
          {copy.noteAdd}
        </button>
      ) : null}
      {canAsk ? (
        <button
          type="button"
          className="zc-selection-action"
          onClick={() => {
            aside?.onAsk(menu.messageId, excerptQuote(menu.text), "selection");
            clear();
          }}
        >
          <MessageSquareQuote size={13} strokeWidth={1.5} />
          {copy.askAside}
        </button>
      ) : null}
    </div>
  );
}
