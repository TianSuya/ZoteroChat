import { describe, expect, it, vi } from "vitest";

import { executeTool } from "./execute";
import type { ToolContext } from "./types";
import type { ToolCall } from "../llm/types";

function call(name: string, args: Record<string, unknown>): ToolCall {
  return {
    id: `call_${name}`,
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}

function context(overrides: Partial<ToolContext> = {}): ToolContext {
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
                title: "Result",
                url: "https://example.com/r",
                snippet: "s",
                summary: "summary",
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch,
    searchBaseUrl: "https://api.deepseek.com",
    searchApiKey: "secret",
    allowPaperDownloads: true,
    askUser: vi.fn(async () => "option A"),
    confirmPaper: vi.fn(async () => true),
    ...overrides,
  };
}

describe("executeTool", () => {
  it("runs a search and returns data plus a trace", async () => {
    const result = await executeTool(
      call("search_web", { query: "attention", count: 3 }),
      context(),
    );
    expect(result.content).toContain("<web-search-results");
    expect(result.content).toContain("https://example.com/r");
    expect(result.trace).toMatchObject({
      name: "search_web",
      status: "ok",
      title: "attention",
      detail: "1 result",
    });
  });

  it("returns invalid JSON arguments as a recoverable error", async () => {
    const result = await executeTool(
      {
        id: "call_bad",
        type: "function",
        function: { name: "search_web", arguments: "{" },
      },
      context(),
    );
    expect(result.content).toMatch(/^ERROR:.*JSON/);
    expect(result.trace.status).toBe("error");
  });

  it("asks the user and returns the answer as tool output", async () => {
    const askUser = vi.fn(async () => "option A");
    const result = await executeTool(
      call("ask_user", {
        question: "Which one?",
        options: ["option A", "option B"],
      }),
      context({ askUser }),
    );
    expect(askUser).toHaveBeenCalledWith({
      question: "Which one?",
      options: ["option A", "option B"],
    });
    expect(result.content).toContain("option A");
    expect(result.trace.status).toBe("ok");
  });

  it("turns tool errors into recoverable output", async () => {
    const result = await executeTool(
      call("fetch_url", { url: "http://127.0.0.1" }),
      context(),
    );
    expect(result.content).toMatch(/^ERROR:/);
    expect(result.trace.status).toBe("error");
  });

  it("refuses to add an unsafe paper URL before asking for confirmation", async () => {
    const confirmPaper = vi.fn(async () => true);
    const result = await executeTool(
      call("add_paper_to_zotero", {
        url: "http://127.0.0.1/a.pdf",
        title: "Bad",
      }),
      context({ confirmPaper }),
    );
    expect(result.trace.status).toBe("error");
    expect(confirmPaper).not.toHaveBeenCalled();
  });

  it("writes an edit_note request through the note context", async () => {
    const editNote = vi.fn(async () => ({
      noteID: 24,
      title: "Note Agent Test",
      charCount: 321,
      mode: "append" as const,
    }));
    const result = await executeTool(
      call("edit_note", { mode: "append", content: "## Summary" }),
      context({ editNote }),
    );
    expect(editNote).toHaveBeenCalledWith({
      mode: "append",
      content: "## Summary",
    });
    expect(result.content).toContain("<note-edited");
    expect(result.trace.status).toBe("ok");
  });

  it("surfaces an unknown tool as an error", async () => {
    const result = await executeTool(call("nope", {}), context());
    expect(result.content).toContain("Unknown tool");
    expect(result.trace.status).toBe("error");
  });
});

it("cancels a candidate list without writing anything", async () => {
  const presentPapers = vi.fn(async () => ({ action: "cancel" as const }));
  const result = await executeTool(
    call("present_papers", {
      papers: [
        { url: "https://example.com/a.pdf", title: "A" },
        { url: "https://example.com/b.pdf", title: "B" },
      ],
    }),
    context({ presentPapers }),
  );
  expect(presentPapers).toHaveBeenCalledTimes(1);
  expect(result.content).toContain("cancelled");
  expect(result.trace.detail).toBe("Cancelled");
});
