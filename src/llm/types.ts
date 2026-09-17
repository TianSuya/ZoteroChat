export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
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
