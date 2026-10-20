import type {
  ChatMessage,
  ToolCall,
  ToolDefinition,
  ToolTrace,
} from "../llm/types";

export type { ChatMessage, ToolCall, ToolDefinition, ToolTrace };

export type AskUserRequest = {
  question: string;
  options?: string[];
};

export type PaperRequest = {
  url: string;
  title: string;
  doi?: string;
  authors?: string[];
  year?: string;
  abstract?: string;
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
};

export type ToolExecution = {
  content: string;
  trace: ToolTrace;
};
