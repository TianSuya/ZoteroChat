import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client/chatCompletions", () => ({
  streamChatCompletions: vi.fn(),
}));

import { runAgentTurn } from "./agent";
import { streamChatCompletions } from "./client/chatCompletions";
import type { ToolContext } from "../tools/types";

const mockStream = vi.mocked(streamChatCompletions);

function context(): ToolContext {
  return {
    itemID: 1,
    libraryID: 1,
    collectionIDs: [],
    fetch: vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                title: "R",
                url: "https://example.com/r",
                snippet: "s",
                summary: "sum",
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch,
    searchBaseUrl: "https://api.deepseek.com",
    searchApiKey: "secret",
    allowPaperDownloads: true,
    askUser: vi.fn(async () => "yes"),
    confirmPaper: vi.fn(async () => true),
  };
}

describe("runAgentTurn", () => {
  beforeEach(() => {
    mockStream.mockReset();
  });

  it("runs a tool round and returns the final answer", async () => {
    mockStream
      .mockResolvedValueOnce({
        content: "Let me search.",
        toolCalls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "search_web",
              arguments: '{"query":"attention"}',
            },
          },
        ],
        finishReason: "tool_calls",
      })
      .mockResolvedValueOnce({
        content: "The answer.",
        toolCalls: [],
        finishReason: "stop",
      });

    const traces: unknown[] = [];
    const result = await runAgentTurn({
      fetch: context().fetch,
      baseUrl: "https://api.deepseek.com",
      apiKey: "secret",
      model: "deepseek-flash",
      messages: [{ role: "user", content: "Question" }],
      tools: [],
      ctx: context(),
      handlers: {
        onDelta: () => undefined,
        onToolTrace: (trace) => traces.push(trace),
      },
    });

    expect(mockStream).toHaveBeenCalledTimes(2);
    expect(result.content).toBe("Let me search.The answer.");
    expect(result.finalContent).toBe("The answer.");
    expect(result.newMessages.map((m) => m.role)).toEqual([
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(result.toolTrace).toHaveLength(1);
    expect(traces.length).toBeGreaterThan(0);
  });

  it("stops immediately when the model returns no tool calls", async () => {
    mockStream.mockResolvedValueOnce({
      content: "Direct answer.",
      toolCalls: [],
      finishReason: "stop",
    });
    const result = await runAgentTurn({
      fetch: context().fetch,
      baseUrl: "https://api.deepseek.com",
      apiKey: "secret",
      model: "deepseek-flash",
      messages: [{ role: "user", content: "Question" }],
      tools: [],
      ctx: context(),
      handlers: { onDelta: () => undefined },
    });
    expect(result.newMessages).toHaveLength(1);
    expect(result.newMessages[0]?.role).toBe("assistant");
  });

  it("returns a recoverable partial transcript at the tool round limit", async () => {
    mockStream.mockResolvedValue({
      content: "",
      toolCalls: [
        {
          id: "call_x",
          type: "function",
          function: { name: "ask_user", arguments: '{"question":"again?"}' },
        },
      ],
      finishReason: "tool_calls",
    });
    const result = await runAgentTurn({
      fetch: context().fetch,
      baseUrl: "https://api.deepseek.com",
      apiKey: "secret",
      model: "deepseek-flash",
      messages: [{ role: "user", content: "Question" }],
      tools: [],
      ctx: context(),
      maxRounds: 2,
      handlers: { onDelta: () => undefined },
    });
    expect(result.exhausted).toBe(true);
    expect(result.finalContent).toMatch(/tool limit/);
    expect(result.newMessages.filter((m) => m.role === "tool")).toHaveLength(2);
    expect(result.newMessages.at(-1)?.role).toBe("assistant");
  });
});
