export type ChatRole = "system" | "user" | "assistant" | "tool";

/** OpenAI-compatible function call, as stored on an assistant message. */
export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

/**
 * Wire-format message. `content` stays a string for every role so the
 * append-only store and the prefix ledger keep working unchanged; tool calls
 * ride alongside it.
 */
export type ChatMessage = {
  role: ChatRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

/** A public (unprivileged) tool schema sent in the request body. */
export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolStatus = "running" | "ok" | "error";

/** One user-visible step of an agent turn, persisted with the final reply. */
export type ToolTrace = {
  id: string;
  name: string;
  status: ToolStatus;
  /** Short human label: search query, paper title, question, … */
  title: string;
  /** Optional result summary or error message. */
  detail?: string;
};

export type Selection = {
  text: string;
  page?: number;
};

export type UsageSnapshot = {
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
};

export type PaperStatus = {
  itemID: number;
  title: string;
  charCount: number;
  hash: string;
};

export type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present when the reply involved tool calls. */
  toolTrace?: ToolTrace[];
};

export type LoadedNote = {
  id: string;
  messageId: string;
  quote: string;
  note: string;
  createdAt: number;
  updatedAt: number;
};

export type LoadedAside = {
  id: string;
  sourceMessageId: string;
  quote: string;
  fromSelection: boolean;
  messages: DisplayMessage[];
};

export type SessionSnapshot = PaperStatus & {
  messages: DisplayMessage[];
  asides: LoadedAside[];
  notes: LoadedNote[];
};
