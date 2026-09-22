import { config } from "../../package.json";
import { panelCopy } from "../i18n/panelCopy";
import { readUiLanguage } from "../i18n/prefs";
import type { BridgeSelection } from "../panel-app/bridge";
import { translateSelection, type TranslateResult } from "../translate";

type Listener = (selection: BridgeSelection | null, itemID: number) => void;
type ExplainListener = (selection: BridgeSelection, itemID: number) => void;

const byItem = new Map<number, BridgeSelection>();
const omitted = new Map<number, string>();
const selectionListeners = new Set<Listener>();
const explainListeners = new Set<ExplainListener>();
let translateAbort: { abort: () => void } | null = null;

const HTML_NS = "http://www.w3.org/1999/xhtml";
const PREFIX = config.prefsPrefix;

function htmlEl<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
): HTMLElementTagNameMap[K] {
  const node = doc.createElementNS
    ? doc.createElementNS(HTML_NS, tag)
    : doc.createElement(tag);
  return node as HTMLElementTagNameMap[K];
}

function newAbortController(): AbortController | null {
  try {
    const Ctor = (
      Zotero.getMainWindow() as unknown as {
        AbortController?: typeof AbortController;
      }
    )?.AbortController;
    if (Ctor) return new Ctor();
  } catch {
    // Plugin sandbox has no window constructors.
  }
  try {
    return new AbortController();
  } catch {
    return null;
  }
}

function readTranslateFontSize(): number {
  const n = Number(Zotero.Prefs.get(`${PREFIX}.translateFontSize`, true));
  if (!Number.isFinite(n)) return 14;
  return Math.min(22, Math.max(12, Math.round(n)));
}

function readPopupSize(): { width: number; height: number } {
  const width = Number(Zotero.Prefs.get(`${PREFIX}.translatePopupWidth`, true));
  const height = Number(
    Zotero.Prefs.get(`${PREFIX}.translatePopupHeight`, true),
  );
  return {
    width: Number.isFinite(width) ? Math.max(184, width) : 280,
    height: Number.isFinite(height) ? Math.max(64, height) : 96,
  };
}

function savePopupSize(area: HTMLTextAreaElement) {
  const width = Math.round(area.offsetWidth);
  const height = Math.round(area.offsetHeight);
  if (width >= 184) {
    Zotero.Prefs.set(`${PREFIX}.translatePopupWidth`, width, true);
  }
  if (height >= 64) {
    Zotero.Prefs.set(`${PREFIX}.translatePopupHeight`, height, true);
  }
}

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

function errorMessage(result: Extract<TranslateResult, { ok: false }>): string {
  const copy = panelCopy(readUiLanguage());
  if (result.code === "missing-key") return copy.translateNeedKey;
  if (result.code === "empty") return copy.translateFailed;
  if (result.detail) return `${copy.translateFailed} · ${result.detail}`;
  return copy.translateFailed;
}

function applyTranslateFont(area: HTMLTextAreaElement, size: number) {
  area.style.fontSize = `${size}px`;
  area.style.lineHeight = `${Math.round(size * 1.4)}px`;
}

function popupChipButton(
  doc: Document,
  label: string,
  extra?: string,
): HTMLButtonElement {
  const btn = htmlEl(doc, "button");
  btn.type = "button";
  btn.textContent = label;
  btn.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "box-sizing:border-box",
    "min-height:28px",
    "padding:4px 8px",
    "border:0",
    "border-radius:4px",
    "cursor:pointer",
    "font:inherit",
    "font-size:12px",
    "line-height:16px",
    "background:var(--color-background,#ffffff)",
    "color:var(--fill-primary,#37352f)",
    extra ?? "",
  ].join(";");
  btn.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  return btn;
}

function popupTranslateBox(doc: Document, source: string): HTMLElement {
  const copy = panelCopy(readUiLanguage());
  const popup = doc.querySelector(".selection-popup") as HTMLElement | null;
  if (popup) popup.style.maxWidth = "none";

  const box = htmlEl(doc, "div");
  box.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "gap:6px",
    "width:100%",
    "margin:0 0 6px",
    "box-sizing:border-box",
  ].join(";");

  const area = htmlEl(doc, "textarea");
  const size = readPopupSize();
  let fontSize = readTranslateFontSize();
  area.rows = 3;
  area.spellcheck = false;
  area.readOnly = true;
  area.value = copy.translatePending;
  area.style.cssText = [
    "box-sizing:border-box",
    "display:block",
    `width:${size.width}px`,
    `height:${size.height}px`,
    "min-width:184px",
    "min-height:64px",
    "max-width:min(480px, 90vw)",
    "max-height:360px",
    "margin:0",
    "padding:8px 10px",
    "border:1px solid var(--fill-quinary,#e9e9e7)",
    "border-radius:6px",
    "resize:both",
    "overflow:auto",
    "font:inherit",
    "color:var(--fill-primary,#37352f)",
    "background:var(--color-background,#ffffff)",
  ].join(";");
  applyTranslateFont(area, fontSize);
  area.addEventListener("pointerup", (event) => event.stopPropagation());
  area.addEventListener("mousedown", (event) => event.stopPropagation());
  area.addEventListener("mouseup", () => savePopupSize(area));

  const tools = htmlEl(doc, "div");
  tools.style.cssText =
    "display:flex;flex-wrap:wrap;gap:4px;align-items:center;";

  const smaller = popupChipButton(doc, "A−");
  smaller.title = copy.translateFontSmaller;
  const larger = popupChipButton(doc, "A+");
  larger.title = copy.translateFontLarger;
  smaller.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    fontSize = Math.max(12, fontSize - 1);
    applyTranslateFont(area, fontSize);
    Zotero.Prefs.set(`${PREFIX}.translateFontSize`, fontSize, true);
  });
  larger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    fontSize = Math.min(22, fontSize + 1);
    applyTranslateFont(area, fontSize);
    Zotero.Prefs.set(`${PREFIX}.translateFontSize`, fontSize, true);
  });

  const copyBtn = popupChipButton(doc, copy.translateCopy);
  copyBtn.disabled = true;
  let translated = "";
  copyBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!translated) return;
    const clip = doc.defaultView?.navigator?.clipboard;
    const done = () => {
      copyBtn.textContent = copy.translateCopied;
      doc.defaultView?.setTimeout(() => {
        if (copyBtn.isConnected) copyBtn.textContent = copy.translateCopy;
      }, 1200);
    };
    if (clip?.writeText) {
      void clip
        .writeText(translated)
        .then(done)
        .catch(() => undefined);
    }
  });

  tools.append(smaller, larger, copyBtn);
  box.append(area, tools);

  translateAbort?.abort();
  const ac = newAbortController();
  translateAbort = ac;
  void translateSelection(source, ac?.signal)
    .then((result) => {
      if (!area.isConnected) return;
      if (ac?.signal.aborted) return;
      if (result.ok) {
        translated = result.text;
        area.value = result.text;
        area.readOnly = false;
        copyBtn.disabled = false;
      } else if (result.code !== "aborted") {
        area.value = errorMessage(result);
      }
    })
    .catch((err) => {
      if (!area.isConnected) return;
      area.value = `${copy.translateFailed} · ${String((err as Error)?.message ?? err)}`;
    });

  return box;
}

function popupButton(
  doc: Document,
  selection: BridgeSelection,
  itemID: number,
): HTMLElement {
  const copy = panelCopy(readUiLanguage());
  const btn = htmlEl(doc, "button");
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
  const explain = popupButton(event.doc, selection, itemID);
  try {
    event.append(popupTranslateBox(event.doc, selection.text), explain);
  } catch (err) {
    ztoolkit.log("translate popup failed", String(err));
    try {
      event.append(explain);
    } catch (inner) {
      ztoolkit.log("explain button failed", String(inner));
    }
  }
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
