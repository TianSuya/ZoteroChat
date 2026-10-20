import { streamChatCompletions } from "./client/chatCompletions";
import { executeTool } from "../tools/execute";
import type {
  ChatMessage,
  ToolDefinition,
  ToolTrace,
  UsageSnapshot,
} from "./types";
import type { ToolContext } from "../tools/types";

const DEFAULT_MAX_ROUNDS = 6;

export type AgentHandlers = {
  onDelta: (text: string) => void;
  onUsage?: (usage: UsageSnapshot) => void;
  onToolTrace?: (trace: ToolTrace[]) => void;
};

export type AgentResult = {
  /** All text streamed across rounds; this is what the panel displays. */
  content: string;
  /** Text of the final assistant message, without pre-tool preambles. */
  finalContent: string;
  /** Assistant/tool messages to append after the current user message. */
  newMessages: ChatMessage[];
  toolTrace: ToolTrace[];
  usage: UsageSnapshot | null;
};

export function addUsage(a: UsageSnapshot, b: UsageSnapshot): UsageSnapshot {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    cacheHitTokens: a.cacheHitTokens + b.cacheHitTokens,
    cacheMissTokens: a.cacheMissTokens + b.cacheMissTokens,
  };
}

/**
 * One user turn as an append-only sequence of model calls and tool results.
 *
 * The loop stops when the model returns no tool calls. Every intermediate
 * message is kept so the next turn can replay the exact wire history; only
 * the final assistant message is shown as a chat bubble.
 */
export async function runAgentTurn(opts: {
  fetch: typeof fetch;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  ctx: ToolContext;
  signal?: AbortSignal;
  maxRounds?: number;
  handlers: AgentHandlers;
}): Promise<AgentResult> {
  const working = [...opts.messages];
  const added: ChatMessage[] = [];
  const toolTrace: ToolTrace[] = [];
  const maxRounds = opts.maxRounds ?? DEFAULT_MAX_ROUNDS;

  let content = "";
  let usage: UsageSnapshot | null = null;

  const publish = (next: ToolTrace) => {
    const index = toolTrace.findIndex((item) => item.id === next.id);
    if (index >= 0) toolTrace[index] = next;
    else toolTrace.push(next);
    opts.handlers.onToolTrace?.([...toolTrace]);
  };

  for (let round = 0; round < maxRounds; round += 1) {
    const result = await streamChatCompletions({
      fetch: opts.fetch,
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      model: opts.model,
      messages: working,
      tools: opts.tools,
      signal: opts.signal,
      handlers: {
        onDelta: opts.handlers.onDelta,
        onUsage: (next) => {
          usage = usage ? addUsage(usage, next) : next;
          opts.handlers.onUsage?.(usage);
        },
      },
    });

    content += result.content;

    if (!result.toolCalls.length) {
      const finalMessage: ChatMessage = {
        role: "assistant",
        content: result.content,
      };
      added.push(finalMessage);
      return {
        content,
        finalContent: result.content,
        newMessages: added,
        toolTrace,
        usage,
      };
    }

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: result.content,
      tool_calls: result.toolCalls,
    };
    working.push(assistantMessage);
    added.push(assistantMessage);

    for (const call of result.toolCalls) {
      publish({
        id: call.id,
        name: call.function.name,
        status: "running",
        title: call.function.name,
      });
      const execution = await executeTool(call, opts.ctx);
      publish(execution.trace);
      const toolMessage: ChatMessage = {
        role: "tool",
        tool_call_id: call.id,
        content: execution.content,
      };
      working.push(toolMessage);
      added.push(toolMessage);
    }
  }

  throw new Error(
    `The model exceeded ${maxRounds} tool rounds. Try a narrower request.`,
  );
}
