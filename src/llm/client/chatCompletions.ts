import { readSseData } from "./sse";
import { normalizeUsage } from "../usage";
import type { ChatMessage, UsageSnapshot } from "../types";

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onUsage?: (usage: UsageSnapshot) => void;
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
 */
export async function streamChatCompletions(opts: {
  fetch: typeof fetch;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  handlers: StreamHandlers;
}): Promise<string> {
  const url = chatCompletionsUrl(opts.baseUrl);
  const res = await opts.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
      stream_options: { include_usage: true },
      thinking: { type: "disabled" },
      max_tokens: 4096,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `LLM ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 400)}` : ""}`,
    );
  }
  if (!res.body) throw new Error("LLM response had no body");

  let full = "";
  for await (const data of readSseData(res.body)) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data) as Record<string, unknown>;
    } catch {
      continue;
    }
    const usage = normalizeUsage(parsed.usage);
    if (usage) opts.handlers.onUsage?.(usage);

    const choices = parsed.choices;
    if (!Array.isArray(choices) || !choices[0]) continue;
    const delta = (choices[0] as { delta?: Record<string, unknown> }).delta;
    const piece = typeof delta?.content === "string" ? delta.content : "";
    if (piece) {
      full += piece;
      opts.handlers.onDelta(piece);
    }
  }
  return full;
}
