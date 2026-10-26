import type {
  ChatMessage,
  ToolCall,
  ToolDefinition,
  ToolTrace,
} from "../llm/types";
import type {
  BridgePaperBatchDecision,
  BridgePaperBatchRequest,
  BridgePaperRequest,
} from "../panel-app/bridge";

export type { ChatMessage, ToolCall, ToolDefinition, ToolTrace };

export type AskUserRequest = {
  question: string;
  options?: string[];
};

export type PaperRequest = BridgePaperRequest;
export type PaperBatchRequest = BridgePaperBatchRequest;
export type PaperBatchDecision = BridgePaperBatchDecision;

export type NoteEditRequest = {
  mode: "append" | "replace";
  /** Markdown section. Rendered to safe HTML before setNote. */
  content: string;
};

export type NoteEditResult = {
  noteID: number;
  title: string;
  charCount: number;
  mode: "append" | "replace";
};

export type PaperResult =
  | {
      status: "added";
      itemID: number;
      attachmentID: number;
      title: string;
    }
  | { status: "duplicate"; itemID: number; title: string }
  | { status: "declined"; title: string }
  | { status: "disabled"; title: string };

/**
 * Everything a tool may touch. Kept explicit so the download/import path
 * cannot quietly reach into arbitrary Zotero APIs.
 */
export type ToolContext = {
  itemID: number;
  libraryID: number;
  collectionIDs: number[];
  fetch: typeof fetch;
  searchBaseUrl: string;
  searchApiKey: string;
  allowPaperDownloads: boolean;
  askUser: (req: AskUserRequest) => Promise<string>;
  confirmPaper: (req: PaperRequest) => Promise<boolean>;
  /** Note surface: one selectable list + one batch confirmation. */
  presentPapers?: (req: PaperBatchRequest) => Promise<PaperBatchDecision>;
  /** Note surface: append or replace the current note. */
  editNote?: (req: NoteEditRequest) => Promise<NoteEditResult>;
  /** Live one-line progress for a long tool (batch imports). */
  onProgress?: (detail: string) => void;
};

export type ToolExecution = {
  content: string;
  trace: ToolTrace;
};
