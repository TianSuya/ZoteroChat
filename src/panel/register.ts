import { config } from "../../package.json";

const PANE_ID = `${config.addonRef}-chat`;
const FTL_NAME = `${config.addonRef}-panel.ftl`;

/** Fluent message IDs are namespaced by the build, mirror that here. */
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
      (body as HTMLElement).dataset.tabType = String(tabType);
      setEnabled(isSupported(item, tabType));
    },

    onItemChange: ({ body, item, tabType, setEnabled }) => {
      const enabled = isSupported(item, tabType);
      (body as HTMLElement).dataset.tabType = String(tabType);
      setEnabled(enabled);
      return enabled;
    },

    onRender: ({ body, item, tabType }) => {
      if (!isSupported(item, tabType)) return;

      // M0 placeholder. The shadow root + React mount replaces this next.
      const el = body as HTMLElement;
      if (el.dataset.zcMounted === "1") return;
      el.dataset.zcMounted = "1";
      el.textContent = `ZoteroChat ready — ${item.getField("title") || item.id}`;
    },

    onDestroy: ({ body }) => {
      delete (body as HTMLElement).dataset.zcMounted;
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
