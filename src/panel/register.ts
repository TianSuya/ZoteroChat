import { config } from "../../package.json";
import {
  onFontSizeChange,
  onPrefsApplied,
  onUiLanguageChange,
  readFontSize,
  readUiLanguage,
} from "../i18n/prefs";
import { beginConversation, streamTurn } from "../llm/session";
import { openPreferences } from "../prefs/register";
import {
  dismissSelection,
  getSelection,
  onExplainRequest,
  onSelectionChange,
} from "../reader/selection";
import { createPanelFrame, type PanelFrame } from "./frame";

const PANE_ID = `${config.addonRef}-chat`;
const FTL_NAME = `${config.addonRef}-panel.ftl`;

/** Fluent message IDs are namespaced by the build; mirror that here. */
function localeID(id: string) {
  return `${config.addonRef}-${id}`;
}

function iconURI(file: string) {
  return `chrome://${config.addonRef}/content/icons/${file}`;
}

function asItem(
  value: Zotero.Item | false | undefined | null,
): Zotero.Item | undefined {
  return value ? value : undefined;
}

/**
 * Reader item pane sometimes hands us the parent work, not the PDF
 * attachment. Chat still keys off the PDF.
 */
function getPdfItem(item: Zotero.Item | undefined): Zotero.Item | undefined {
  if (!item) return undefined;
  if (item.isPDFAttachment?.()) return item;
  if (item.isRegularItem?.()) {
    for (const id of item.getAttachments()) {
      const att = asItem(Zotero.Items.get(id));
      if (att?.isPDFAttachment?.()) return att;
    }
  }
  return undefined;
}

function renderEmpty(body: HTMLElement) {
  const doc = body.ownerDocument;
  if (!doc) return;
  ensureFTL(doc);
  const p = doc.createElement("p");
  p.setAttribute("data-l10n-id", localeID("panel-not-a-pdf"));
  p.style.cssText =
    "margin:12px 10px;font-size:13px;line-height:1.5;color:var(--fill-secondary,#6f6e69);";
  body.replaceChildren(p);
}

/** The FTL has to be in the document before any l10nID on the section resolves. */
function ensureFTL(doc: Document) {
  try {
    (doc.defaultView as any)?.MozXULElement?.insertFTLIfNeeded(FTL_NAME);
  } catch (err) {
    ztoolkit.log("failed to insert FTL", err);
  }
}

/**
 * Live frames, keyed by the section body they live in.
 *
 * Frames are deliberately never moved: reparenting an iframe reloads its
 * document, which would drop React state mid-stream. Zotero hands us a fresh
 * body per item pane instance, so one frame per body is the natural grain —
 * anything worth surviving a reload belongs in the store, not in the DOM.
 */
const frames = new WeakMap<
  HTMLElement,
  { frame: PanelFrame; itemID: number }
>();

export function registerPanelSection() {
  const sectionID = Zotero.ItemPaneManager.registerSection({
    paneID: PANE_ID,
    pluginID: config.addonID,
    header: {
      l10nID: localeID("panel-header"),
      // Zotero writes this straight into `data-l10n-args`; leaving it unset
      // yields the literal string "undefined", which is invalid JSON.
      l10nArgs: "{}",
      icon: iconURI("section-16.png"),
    },
    sidenav: {
      l10nID: localeID("panel-sidenav-tooltip"),
      l10nArgs: "{}",
      icon: iconURI("section-20.png"),
    },

    onInit: ({ doc, setEnabled }) => {
      ensureFTL(doc);
      // Do not setEnabled(false) here: item/tabType are often unset on
      // init, and hiding the sidenav in that round skips the same-pass
      // render (environment.md §6). The icon must stay visible so users
      // can find the pane after installing from an XPI.
      setEnabled(true);
    },

    onItemChange: ({ setEnabled }) => {
      setEnabled(true);
      return true;
    },

    onRender: ({ body, item, tabType }) => {
      const el = body as HTMLElement;
      const doc = el.ownerDocument;
      if (!doc) return;

      const pdf = tabType === "reader" ? getPdfItem(item) : undefined;
      if (!pdf) {
        frames.get(el)?.frame.destroy();
        frames.delete(el);
        renderEmpty(el);
        return;
      }

      const existing = frames.get(el);
      if (existing?.itemID === pdf.id) return;
      existing?.frame.destroy();

      const itemID = pdf.id;
      const parentRaw = pdf.parentID
        ? Zotero.Items.get(pdf.parentID)
        : undefined;
      const parent = parentRaw ? parentRaw : undefined;
      const paperTitle =
        (parent?.getField("title") as string | undefined) ||
        (pdf.getField("title") as string | undefined) ||
        pdf.attachmentFilename ||
        String(itemID);

      const frame = createPanelFrame(doc, {
        itemID,
        paperTitle,
        env: __env__,
        showProbe: Boolean(
          Zotero.Prefs.get(`${config.prefsPrefix}.devShowRadixProbe`, true),
        ),
        showAssistantProbe: Boolean(
          Zotero.Prefs.get(`${config.prefsPrefix}.devShowAssistantProbe`, true),
        ),
        beginConversation: () => beginConversation(itemID),
        openPreferences,
        getUiLanguage: readUiLanguage,
        onUiLanguageChange,
        getFontSize: readFontSize,
        onFontSizeChange,
        onPrefsApplied,
        getSelection: () => getSelection(itemID),
        dismissSelection: () => dismissSelection(itemID),
        onSelectionChange: (listener) =>
          onSelectionChange((sel, id) => {
            if (id === itemID) listener(sel);
          }),
        onExplainRequest: (listener) =>
          onExplainRequest((sel, id) => {
            if (id === itemID) listener(sel);
          }),
        streamTurn: (req, handlers) => streamTurn(itemID, req, handlers),
      });

      frames.set(el, { frame, itemID });
      el.replaceChildren(frame.element);
      frame.attached();
    },

    onDestroy: ({ body }) => {
      const el = body as HTMLElement;
      frames.get(el)?.frame.destroy();
      frames.delete(el);
    },
  } as Parameters<typeof Zotero.ItemPaneManager.registerSection>[0]);

  addon.data.registry.sectionID = sectionID;
  ztoolkit.log("registered item pane section", sectionID);
}

export function unregisterPanelSection() {
  const id = addon.data.registry.sectionID;
  if (!id) return;
  Zotero.ItemPaneManager.unregisterSection(id);
  addon.data.registry.sectionID = undefined;
}
