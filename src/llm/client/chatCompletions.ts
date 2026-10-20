import { readSseData } from "./sse";
import { ToolCallCollector } from "./toolCallDelta";
import { normalizeUsage } from "../usage";
import type {
  ChatMessage,
  ToolCall,
  ToolDefinition,
  UsageSnapshot,
} from "../types";

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onUsage?: (usage: UsageSnapshot) => void;
};

export type StreamResult = {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
};

export function chatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/chat/completions`;
}

/**
 * OpenAI-compatible Chat Completions, streamed.
 *
 * `fetch` is taken from the caller so the plugin sandbox can use the main
 * window's fetch (the sandbox itself has no browsing context).
 *
 * Tool calls are streamed as partial JSON arguments, so they are assembled
 * here and returned once the stream ends. Text deltas are forwarded live; the
 * caller runs the tool loop.
 */
export async function streamChatCompletions(opts: {
  fetch: typeof fetch;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  signal?: AbortSignal;
  handlers: StreamHandlers;
}): Promise<StreamResult> {
  const url = chatCompletionsUrl(opts.baseUrl);
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
    stream_options: { include_usage: true },
    thinking: { type: "disabled" },
    max_tokens: 4096,
  };
  if (opts.tools?.length) body.tools = opts.tools;

  const res = await opts.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LLM ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 400)}` : ""}`,
    );
  }
  if (!res.body) throw new Error("LLM response had no body");

  let full = "";
  let finishReason: string | null = null;
  const toolCalls = new ToolCallCollector();

  for await (const data of readSseData(res.body)) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data) as Record<string, unknown>;
    } catch {
      continue;
    }

    const error = parsed.error as { message?: unknown } | undefined;
    if (error) {
      throw new Error(
        `LLM: ${typeof error.message === "string" ? error.message : "stream error"}`,
      );
    }

    const usage = normalizeUsage(parsed.usage);
    if (usage) opts.handlers.onUsage?.(usage);

    const choices = parsed.choices;
    if (!Array.isArray(choices) || !choices[0]) continue;
    const choice = choices[0] as {
      delta?: Record<string, unknown>;
      finish_reason?: unknown;
    };
    if (typeof choice.finish_reason === "string") {
      finishReason = choice.finish_reason;
    }

    const delta = choice.delta;
    const piece = typeof delta?.content === "string" ? delta.content : "";
    if (piece) {
      full += piece;
      opts.handlers.onDelta(piece);
    }

    const rawCalls = delta?.tool_calls;
    if (Array.isArray(rawCalls)) {
      for (const raw of rawCalls) toolCalls.add(raw);
    }
  }

  return { content: full, toolCalls: toolCalls.finish(), finishReason };
}
