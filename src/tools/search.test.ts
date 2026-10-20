import { describe, expect, it, vi } from "vitest";

import { fetchPage, searchWeb, toolsEndpoint } from "./search";

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

describe("toolsEndpoint", () => {
  it("normalizes the DeepSeek base URL", () => {
    expect(toolsEndpoint("https://api.deepseek.com", "search")).toBe(
      "https://api.deepseek.com/v1/tools/search",
    );
    expect(toolsEndpoint("https://api.deepseek.com/", "fetch")).toBe(
      "https://api.deepseek.com/v1/tools/fetch",
    );
    expect(toolsEndpoint("https://api.deepseek.com/v1", "search")).toBe(
      "https://api.deepseek.com/v1/tools/search",
    );
  });
});

describe("searchWeb", () => {
  it("sends the documented body and maps results", async () => {
    const fetchImpl = jsonFetch({
      results: [
        {
          title: "Paper",
          url: "https://example.com/paper",
          snippet: "short",
          summary: "long",
          site_name: "Example",
          date: "2026-01-01T00:00:00Z",
          authority: 3,
        },
      ],
    });
    const results = await searchWeb({
      fetch: fetchImpl,
      baseUrl: "https://api.deepseek.com",
      apiKey: "secret",
      query: "attention",
      oriQuestion: "What is attention?",
      count: 3,
    });

    expect(results).toEqual([
      {
        title: "Paper",
        url: "https://example.com/paper",
        snippet: "short",
        summary: "long",
        siteName: "Example",
        date: "2026-01-01T00:00:00Z",
        authority: 3,
      },
    ]);

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe("https://api.deepseek.com/v1/tools/search");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(JSON.parse(String(init?.body))).toEqual({
      query: "attention",
      count: 3,
      ori_question: "What is attention?",
      need_content: false,
    });
  });

  it("returns an empty list for no matches", async () => {
    const results = await searchWeb({
      fetch: jsonFetch({ results: [] }),
      baseUrl: "https://api.deepseek.com",
      apiKey: "secret",
      query: "nothing",
    });
    expect(results).toEqual([]);
  });

  it("surfaces API errors with their message", async () => {
    await expect(
      searchWeb({
        fetch: jsonFetch(
          { error: { message: "insufficient balance", code: "x" } },
          402,
        ),
        baseUrl: "https://api.deepseek.com",
        apiKey: "secret",
        query: "x",
      }),
    ).rejects.toThrow(/insufficient balance/);
  });
});

describe("fetchPage", () => {
  it("returns title and markdown content", async () => {
    const page = await fetchPage({
      fetch: jsonFetch({ title: "A page", content: "# Body" }),
      baseUrl: "https://api.deepseek.com",
      apiKey: "secret",
      url: "https://example.com/a",
    });
    expect(page).toEqual({ title: "A page", content: "# Body" });
  });

  it("rejects an empty page", async () => {
    await expect(
      fetchPage({
        fetch: jsonFetch({ title: "Empty", content: "" }),
        baseUrl: "https://api.deepseek.com",
        apiKey: "secret",
        url: "https://example.com/a",
      }),
    ).rejects.toThrow(/no readable content/);
  });
});
