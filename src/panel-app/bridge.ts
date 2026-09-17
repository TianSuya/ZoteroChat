/**
 * The contract between the plugin (privileged Zotero context) and the panel
 * app (a real HTML document in an iframe).
 *
 * Both sides run with chrome privileges in the same process, so this is a
 * direct object handoff — no postMessage, no serialization. Keeping the
 * surface explicit anyway makes it obvious what the UI is allowed to touch.
 */
import type { UiLanguage } from "../i18n/languages";

export type BridgePaperStatus = {
  itemID: number;
  title: string;
  charCount: number;
  hash: string;
};

export type BridgeUsage = {
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
};

export type BridgeSelection = {
  text: string;
  page?: number;
};

export type BridgeStreamJob = {
  cancel: () => void;
  done: Promise<void>;
};

export interface PanelBridge {
  /** Attachment item backing this conversation. */
  itemID: number;
  paperTitle: string;
  /** Build mode, so the app can gate dev-only fixtures. */
  env: "development" | "production";
  /** Opt-in Radix-in-iframe probe. Off by default: it opens every floating
   *  layer at once, which is useful as a check and unusable as a UI. */
  showProbe: boolean;
  /** Opt-in assistant-ui runtime probe. */
  showAssistantProbe: boolean;
  /** Extract (or reuse) the frozen paper prefix for this attachment. */
  beginConversation: () => Promise<BridgePaperStatus>;
  /** Open this plugin's pane in Zotero settings. */
  openPreferences: () => void;
  /** Resolved UI language for chips, placeholders, and slash commands. */
  getUiLanguage: () => UiLanguage;
  onUiLanguageChange?: (listener: (lang: UiLanguage) => void) => () => void;
  getFontSize: () => number;
  onFontSizeChange?: (listener: (size: number) => void) => () => void;
  /** Live PDF selection for this attachment. */
  getSelection: () => BridgeSelection | null;
  /** Drop the current highlight from this turn's context until the user selects again. */
  dismissSelection: () => void;
  onSelectionChange?: (
    listener: (selection: BridgeSelection | null) => void,
  ) => () => void;
  /** Fired when the reader popup "explain selection" button is clicked. */
  onExplainRequest?: (
    listener: (selection: BridgeSelection) => void,
  ) => () => void;
  /** Send one turn. The plugin owns the wire-format history. */
  streamTurn: (
    req: { question: string; selection?: BridgeSelection | null },
    handlers: {
      onDelta: (text: string) => void;
      onUsage?: (usage: BridgeUsage) => void;
      onPrefixBreak?: () => void;
    },
  ) => BridgeStreamJob;
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
