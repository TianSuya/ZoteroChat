/**
 * The contract between the plugin (privileged Zotero context) and the panel
 * app (a real HTML document in an iframe).
 *
 * Both sides run with chrome privileges in the same process, so this is a
 * direct object handoff — no postMessage, no serialization. Keeping the
 * surface explicit anyway makes it obvious what the UI is allowed to touch.
 */
import type { UiLanguage } from "../i18n/languages";
import type { LoadedNote, ToolTrace } from "../llm/types";

export type BridgePaperStatus = {
  itemID: number;
  title: string;
  charCount: number;
  hash: string;
};

export type BridgeDisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present when the reply involved tool calls. */
  toolTrace?: ToolTrace[];
};

export type BridgeNote = LoadedNote;

export type BridgeAside = {
  id: string;
  sourceMessageId: string;
  quote: string;
  fromSelection: boolean;
  messages: BridgeDisplayMessage[];
};

export type BridgeMode = "paper" | "note";

export type BridgeNoteContext = {
  noteID: number;
  noteKey: string;
  libraryID: number;
  title: string;
  charCount: number;
};

export type BridgeSession = BridgePaperStatus & {
  mode: BridgeMode;
  note: BridgeNoteContext | null;
  messages: BridgeDisplayMessage[];
  asides: BridgeAside[];
  notes: BridgeNote[];
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

export type BridgeAskUserRequest = {
  question: string;
  options?: string[];
};

export type BridgePaperRequest = {
  url: string;
  title: string;
  doi?: string;
  authors?: string[];
  year?: string;
  venue?: string;
  abstract?: string;
};

export type BridgePaperBatchRequest = {
  papers: BridgePaperRequest[];
  note?: string;
};

export type BridgePaperBatchDecision =
  { action: "add"; selected: BridgePaperRequest[] } | { action: "cancel" };

/** What the panel is currently waiting for the user to answer. */
export type BridgePendingPrompt =
  | ({ kind: "question" } & BridgeAskUserRequest)
  | ({ kind: "paper" } & BridgePaperRequest)
  | ({ kind: "papers" } & BridgePaperBatchRequest);

export interface PanelBridge {
  /** Surface this panel was mounted for. */
  mode: BridgeMode;
  /** Standalone-note scope when `mode === "note"`. */
  note?: BridgeNoteContext;
  /** Attachment item backing this conversation; noteID in note mode. */
  itemID: number;
  paperTitle: string;
  /** Build mode, so the app can gate dev-only fixtures. */
  env: "development" | "production";
  /** Opt-in Radix-in-iframe probe. Off by default: it opens every floating
   *  layer at once, which is useful as a check and unusable as a UI. */
  showProbe: boolean;
  /** Opt-in assistant-ui runtime probe. */
  showAssistantProbe: boolean;
  /** Open the saved conversation for this PDF (creates one if needed). */
  beginConversation: () => Promise<BridgeSession>;
  /** Archive the current thread and start a blank one. */
  resetConversation: () => Promise<BridgeSession>;
  /** Open this plugin's pane in Zotero settings. */
  openPreferences: () => void;
  /** Resolved UI language for chips, placeholders, and slash commands. */
  getUiLanguage: () => UiLanguage;
  onUiLanguageChange?: (listener: (lang: UiLanguage) => void) => () => void;
  getFontSize: () => number;
  onFontSizeChange?: (listener: (size: number) => void) => () => void;
  /** Settings "Apply" — re-read prefs without tearing down the conversation. */
  onPrefsApplied?: (listener: () => void) => () => void;
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
  /** Send one turn. The plugin owns the wire-format history and tool loop. */
  streamTurn: (
    req: {
      question: string;
      selection?: BridgeSelection | null;
      userId?: string;
      assistantId?: string;
    },
    handlers: {
      onDelta: (text: string) => void;
      onUsage?: (usage: BridgeUsage) => void;
      onPrefixBreak?: () => void;
      onToolTrace?: (trace: ToolTrace[]) => void;
      /** Model asks the user something; resolves with the answer. */
      onAskUser?: (req: BridgeAskUserRequest) => Promise<string>;
      /** Model wants to write a paper to the library; resolves true to proceed. */
      onConfirmPaper?: (req: BridgePaperRequest) => Promise<boolean>;
      /** Note surface: show a selectable candidate list and one batch confirmation. */
      onPresentPapers?: (
        req: BridgePaperBatchRequest,
      ) => Promise<BridgePaperBatchDecision>;
    },
  ) => BridgeStreamJob;
  /** Snapshot main turns and start an aside that reuses the paper prefix. */
  beginAside: (req: {
    id: string;
    quote: string;
    sourceMessageId: string;
    fromSelection?: boolean;
  }) => void;
  streamAsideTurn: (
    req: {
      asideId: string;
      question: string;
      userId?: string;
      assistantId?: string;
    },
    handlers: {
      onDelta: (text: string) => void;
      onUsage?: (usage: BridgeUsage) => void;
      onPrefixBreak?: () => void;
      onToolTrace?: (trace: ToolTrace[]) => void;
    },
  ) => BridgeStreamJob;
  /** Persist a note on a message selection. Notes never enter the prompt. */
  saveNote: (req: {
    id: string;
    messageId: string;
    quote: string;
    note: string;
  }) => Promise<BridgeNote>;
  updateNote: (req: { id: string; note: string }) => Promise<BridgeNote | null>;
  deleteNote: (id: string) => Promise<void>;
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
