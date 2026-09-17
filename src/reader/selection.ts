import { config } from "../../package.json";
import { panelCopy } from "../i18n/panelCopy";
import { readUiLanguage } from "../i18n/prefs";
import type { BridgeSelection } from "../panel-app/bridge";

type Listener = (selection: BridgeSelection | null, itemID: number) => void;
type ExplainListener = (selection: BridgeSelection, itemID: number) => void;

const byItem = new Map<number, BridgeSelection>();
const omitted = new Map<number, string>();
const selectionListeners = new Set<Listener>();
const explainListeners = new Set<ExplainListener>();

function fingerprint(selection: BridgeSelection): string {
  return `${selection.page ?? ""}:${selection.text}`;
}

function itemIDOf(reader: {
  itemID?: number;
  _item?: Zotero.Item;
}): number | undefined {
  return reader.itemID ?? reader._item?.id;
}

function pageOf(annotation: {
  position?: { pageIndex?: number };
}): number | undefined {
  const index = annotation.position?.pageIndex;
  return typeof index === "number" ? index + 1 : undefined;
}

function notify(itemID: number, selection: BridgeSelection | null) {
  for (const listener of selectionListeners) listener(selection, itemID);
}

function revealChatPane() {
  try {
    const win = Zotero.getMainWindow();
    const btn = win?.document?.querySelector?.(
      `[data-pane="${config.addonRef}-chat"]`,
    ) as { click?: () => void } | null;
    btn?.click?.();
  } catch {
    // Best-effort: the chip still updates if the pane is already open.
  }
}

function popupButton(
  doc: Document,
  selection: BridgeSelection,
  itemID: number,
): HTMLElement {
  const copy = panelCopy(readUiLanguage());
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.textContent = copy.explainSelection;
  btn.style.cssText = [
    "display:block",
    "box-sizing:border-box",
    "width:100%",
    "margin:8px 0 2px",
    "padding:6px 12px",
    "min-height:28px",
    "border:0",
    "border-radius:4px",
    "cursor:pointer",
    "font:inherit",
    "font-size:13px",
    "line-height:18px",
    "text-align:left",
    "background:var(--fill-quinary,#efefed)",
    "color:var(--fill-primary,#37352f)",
  ].join(";");
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "var(--color-button,#e6e6e6)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "var(--fill-quinary,#efefed)";
  });
  btn.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    omitted.delete(itemID);
    byItem.set(itemID, selection);
    revealChatPane();
    for (const listener of explainListeners) listener(selection, itemID);
  });
  return btn;
}

function onPopup(event: {
  reader: { itemID?: number; _item?: Zotero.Item };
  doc: Document;
  params: { annotation?: { text?: string; position?: { pageIndex?: number } } };
  append: (...nodes: Array<Node | string>) => void;
}) {
  const itemID = itemIDOf(event.reader);
  const text = event.params.annotation?.text?.trim();
  if (!itemID || !text) return;

  const selection: BridgeSelection = {
    text,
    page: pageOf(event.params.annotation ?? {}),
  };
  omitted.delete(itemID);
  byItem.set(itemID, selection);
  notify(itemID, selection);

  const show = Zotero.Prefs.get(
    `${config.prefsPrefix}.showSelectionPopupButtons`,
    true,
  );
  if (!show) return;
  event.append(popupButton(event.doc, selection, itemID));
}

function liveTextFromReader(reader: any): string {
  const windows: Array<Window | undefined> = [
    reader._iframeWindow as Window | undefined,
    reader._internalReader?._iframeWindow as Window | undefined,
  ];
  try {
    const inner = (reader._iframeWindow as any)?.wrappedJSObject
      ?._internalReader?._primaryView?._iframe?.contentWindow as
      Window | undefined;
    windows.push(inner);
  } catch {
    // Private reader fields are best-effort.
  }
  for (const win of windows) {
    try {
      const text = win?.getSelection?.()?.toString()?.trim();
      if (text) return text;
    } catch {
      // Cross-window access can throw; try the next frame.
    }
  }
  return "";
}

function readLiveSelection(itemID: number): BridgeSelection | null {
  try {
    const win = Zotero.getMainWindow() as any;
    const tabID = win?.Zotero_Tabs?.selectedID as string | undefined;
    const reader = tabID ? Zotero.Reader.getByTabID(tabID) : undefined;
    if (!reader || itemIDOf(reader) !== itemID) return null;
    const text = liveTextFromReader(reader);
    if (!text) return null;
    const prev = byItem.get(itemID);
    return { text, page: prev?.page };
  } catch {
    return null;
  }
}

export function getSelection(itemID: number): BridgeSelection | null {
  const live = readLiveSelection(itemID);
  if (live) {
    if (omitted.get(itemID) === fingerprint(live)) return null;
    byItem.set(itemID, live);
    return live;
  }
  const stored = byItem.get(itemID);
  if (!stored) return null;
  if (omitted.get(itemID) === fingerprint(stored)) return null;
  return stored;
}

/** Chip was dismissed: do not reattach this highlight until the user selects again. */
export function dismissSelection(itemID: number): void {
  const current = byItem.get(itemID) ?? readLiveSelection(itemID);
  if (current) omitted.set(itemID, fingerprint(current));
  byItem.delete(itemID);
  notify(itemID, null);
}

export function onSelectionChange(listener: Listener): () => void {
  selectionListeners.add(listener);
  return () => selectionListeners.delete(listener);
}

export function onExplainRequest(listener: ExplainListener): () => void {
  explainListeners.add(listener);
  return () => explainListeners.delete(listener);
}

export function registerReaderSelection() {
  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    onPopup,
    config.addonID,
  );
  ztoolkit.log("registered reader selection listener");
}

export function unregisterReaderSelection() {
  Zotero.Reader.unregisterEventListener("renderTextSelectionPopup", onPopup);
}
