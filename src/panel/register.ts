import { config } from "../../package.json";
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

/**
 * The panel is reader-only for now: the whole design hangs off "one open PDF,
 * one conversation", which the library view has no equivalent of.
 */
function isSupported(item: Zotero.Item | undefined, tabType: unknown): boolean {
  if (tabType !== "reader") return false;
  return Boolean(item?.isPDFAttachment?.());
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
const frames = new WeakMap<HTMLElement, PanelFrame>();

export function registerPanelSection() {
  const sectionID = Zotero.ItemPaneManager.registerSection({
    paneID: PANE_ID,
    pluginID: config.addonID,
    header: {
      l10nID: localeID("panel-header"),
      // Zotero writes this straight into `data-l10n-args`; leaving it unset
      // yields the literal string "undefined", which is invalid JSON.
      l10nArgs: "{}",
      icon: iconURI("section-16.svg"),
    },
    sidenav: {
      l10nID: localeID("panel-sidenav-tooltip"),
      l10nArgs: "{}",
      icon: iconURI("section-20.svg"),
    },

    onInit: ({ doc, body, item, tabType, setEnabled }) => {
      ensureFTL(doc);
      setEnabled(isSupported(item, tabType));
    },

    onItemChange: ({ item, tabType, setEnabled }) => {
      const enabled = isSupported(item, tabType);
      setEnabled(enabled);
      return enabled;
    },

    onRender: ({ body, item, tabType }) => {
      if (!isSupported(item, tabType)) return;

      const el = body as HTMLElement;
      const doc = el.ownerDocument;
      if (!doc || frames.has(el)) return;

      const frame = createPanelFrame(doc, {
        itemID: item.id,
        paperTitle: item.getField("title") || String(item.id),
        env: __env__,
        showProbe: Boolean(
          Zotero.Prefs.get(`${config.prefsPrefix}.devShowRadixProbe`, true),
        ),
      });

      frames.set(el, frame);
      el.replaceChildren(frame.element);
      frame.attached();
    },

    onDestroy: ({ body }) => {
      const el = body as HTMLElement;
      frames.get(el)?.destroy();
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
