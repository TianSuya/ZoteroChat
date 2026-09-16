/**
 * The contract between the plugin (privileged Zotero context) and the panel
 * app (a real HTML document in an iframe).
 *
 * Both sides run with chrome privileges in the same process, so this is a
 * direct object handoff — no postMessage, no serialization. Keeping the
 * surface explicit anyway makes it obvious what the UI is allowed to touch.
 */
export interface PanelBridge {
  /** Attachment item backing this conversation. */
  itemID: number;
  paperTitle: string;
  /** Build mode, so the app can gate dev-only fixtures. */
  env: "development" | "production";
  /** Design tokens copied from the host window, plus the resolved theme. */
  theme: {
    mode: "light" | "dark";
    tokens: Record<string, string>;
  };
  /** Called by the app when the theme should be re-read (host pushes updates). */
  onThemeChange?: (
    listener: (theme: PanelBridge["theme"]) => void,
  ) => () => void;
}

/**
 * Handshake hook the host attaches to the iframe element before inserting it.
 *
 * The frame's own `load` event proved unreliable in the item pane, and it
 * answers the wrong question anyway: what the host needs to know is when the
 * panel *bundle* is ready, not when the document finished parsing.
 */
export interface PanelFrameElement {
  __zcOnReady?: () => void;
}
