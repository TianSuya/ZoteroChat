/**
 * DeepSeek Search & Fetch REST clients.
 *
 * These are raw JSON APIs, separate from Chat Completions but using the same
 * Bearer key system. They are billed per successful request, not per token.
 * https://api-docs.deepseek.com/guides/search/
 */

export const MAX_FETCH_CHARS = 24_000;

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  summary: string;
  siteName?: string;
  date?: string;
  authority?: number;
};

export type FetchedPage = {
  title: string;
  content: string;
};

export function toolsEndpoint(
  baseUrl: string,
  name: "search" | "fetch",
): string {
  const raw = baseUrl.trim().replace(/\/+$/, "");
  const base = raw || "https://api.deepseek.com";
  const root = base.replace(/\/beta$/, "");
  const versioned = root.endsWith("/v1") ? root : `${root}/v1`;
  return `${versioned}/tools/${name}`;
}

function clampCount(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 5;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function clip(value: string, max: number): string {
  const chars = [...value.trim()];
  return chars.length <= max ? chars.join("") : chars.slice(0, max).join("");
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  apiKey: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  const text = await res.text().catch(() => "");
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const record =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : null;
    const error = record?.error;
    const message =
      error &&
      typeof error === "object" &&
      typeof (error as { message?: unknown }).message === "string"
        ? String((error as { message: string }).message)
        : text.slice(0, 240);
    throw new Error(
      `DeepSeek ${res.status} ${res.statusText}${message ? `: ${message}` : ""}`,
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("DeepSeek returned a non-JSON response.");
  }
  return data as Record<string, unknown>;
}

export async function searchWeb(opts: {
  fetch: typeof fetch;
  baseUrl: string;
  apiKey: string;
  query: string;
  count?: number;
  oriQuestion?: string;
  signal?: AbortSignal;
}): Promise<WebSearchResult[]> {
  const query = clip(opts.query, 128);
  if (!query) throw new Error("Search query is empty.");
  const oriQuestion = clip(opts.oriQuestion ?? "", 128);

  const data = await postJson(
    opts.fetch,
    toolsEndpoint(opts.baseUrl, "search"),
    opts.apiKey,
    {
      query,
      count: clampCount(opts.count),
      ...(oriQuestion ? { ori_question: oriQuestion } : {}),
      need_content: false,
    },
    opts.signal,
  );

  const raw = Array.isArray(data.results) ? data.results : [];
  const out: WebSearchResult[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const url = typeof row.url === "string" ? row.url.trim() : "";
    if (!title || !url) continue;
    out.push({
      title,
      url,
      snippet: typeof row.snippet === "string" ? row.snippet : "",
      summary: typeof row.summary === "string" ? row.summary : "",
      siteName: typeof row.site_name === "string" ? row.site_name : undefined,
      date: typeof row.date === "string" ? row.date : undefined,
      authority: typeof row.authority === "number" ? row.authority : undefined,
    });
  }
  return out;
}

export async function fetchPage(opts: {
  fetch: typeof fetch;
  baseUrl: string;
  apiKey: string;
  url: string;
  signal?: AbortSignal;
}): Promise<FetchedPage> {
  const url = opts.url.trim();
  if (!url) throw new Error("URL is empty.");
  if (url.length > 8192) throw new Error("URL is too long.");

  const data = await postJson(
    opts.fetch,
    toolsEndpoint(opts.baseUrl, "fetch"),
    opts.apiKey,
    { url },
    opts.signal,
  );

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (!content) throw new Error("Fetch returned no readable content.");
  return {
    title,
    content: clip(content, MAX_FETCH_CHARS),
  };
}
