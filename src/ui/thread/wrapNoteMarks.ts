import type { RectLike } from "./noteContext";

const SKIP = "math, .zc-aside-quote, .zc-note-mark";

type Pos = { node: Text; offset: number };

function collectText(root: HTMLElement): Text[] {
  const out: Text[] = [];
  const walk = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walk.nextNode())) {
    const text = node as Text;
    const parent = text.parentElement;
    if (parent?.closest(SKIP)) continue;
    out.push(text);
  }
  return out;
}

function collapseMap(nodes: Text[]): { collapsed: string; map: Pos[] } {
  let collapsed = "";
  const map: Pos[] = [];
  let prevSpace = true;
  for (const node of nodes) {
    const data = node.data;
    for (let i = 0; i < data.length; i++) {
      const space = /\s/.test(data[i]!);
      if (space) {
        if (!prevSpace) {
          map.push({ node, offset: i });
          collapsed += " ";
          prevSpace = true;
        }
      } else {
        map.push({ node, offset: i });
        collapsed += data[i]!;
        prevSpace = false;
      }
    }
  }
  return { collapsed: collapsed.replace(/ +$/, ""), map };
}

function needleOf(quote: string): string {
  return quote.replace(/…$/, "").replace(/\s+/g, " ").trim();
}

function rectOf(el: Element): RectLike {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function wrapRange(
  doc: Document,
  start: Pos,
  end: Pos,
  note: { id: string; note?: string },
  onOpen: (noteId: string, rect: RectLike) => void,
): void {
  const range = doc.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  if (range.collapsed) return;
  const span = doc.createElement("span");
  span.className = "zc-note-mark";
  span.dataset.noteId = note.id;
  if (note.note) {
    span.title = note.note;
    span.setAttribute("aria-label", note.note);
  }
  let down: { x: number; y: number } | null = null;
  span.addEventListener("mousedown", (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  span.addEventListener("click", (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
    const sel = doc.getSelection();
    if (sel && !sel.isCollapsed) return;
    e.preventDefault();
    e.stopPropagation();
    onOpen(note.id, rectOf(span));
  });
  try {
    range.surroundContents(span);
  } catch {
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }
}

export function unwrapNoteMarks(root: HTMLElement): void {
  const marks = Array.from(root.querySelectorAll(".zc-note-mark")).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  for (const el of marks) {
    const parent = el.parentNode;
    if (!parent) continue;
    let child = el.firstChild;
    while (child) {
      parent.insertBefore(child, el);
      child = el.firstChild;
    }
    parent.removeChild(el);
    if (parent instanceof HTMLElement) parent.normalize();
  }
}

export function wrapNoteMarks(
  root: HTMLElement,
  notes: { id: string; quote: string; note?: string }[],
  onOpen: (noteId: string, rect: RectLike) => void,
): void {
  unwrapNoteMarks(root);
  if (!notes.length) return;
  const sorted = [...notes].sort((a, b) => b.quote.length - a.quote.length);
  for (const note of sorted) {
    const needle = needleOf(note.quote);
    if (needle.length < 2) continue;
    const { collapsed, map } = collapseMap(collectText(root));
    const at = collapsed.indexOf(needle);
    if (at < 0) continue;
    const start = map[at];
    const end = map[at + needle.length - 1];
    if (!start || !end) continue;
    wrapRange(root.ownerDocument, start, end, note, onOpen);
  }
}
