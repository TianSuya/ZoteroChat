import type { ToolCall } from "../llm/types";
import { findExistingByDoi, addPaperToZotero, isSafeHttpUrl } from "./library";
import { fetchPage, searchWeb } from "./search";
import type {
  AskUserRequest,
  PaperRequest,
  ToolContext,
  ToolExecution,
} from "./types";

const MAX_TOOL_RESULT_CHARS = 24_000;

function parseArgs(raw: string): Record<string, unknown> {
  const text = raw.trim();
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Tool arguments were not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayArg(args: Record<string, unknown>, key: string): string[] {
  const value = args[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberArg(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

function escapeForDataBlock(json: string): string {
  // Keep the JSON valid while preventing a result title from closing our
  // pseudo-XML data block.
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function isAbort(err: unknown): boolean {
  return (err as { name?: string })?.name === "AbortError";
}

function formatSearchResults(
  query: string,
  results: Awaited<ReturnType<typeof searchWeb>>,
): string {
  const payload = results.map((result) => ({
    title: result.title,
    url: result.url,
    site: result.siteName,
    published: result.date,
    summary: result.summary || result.snippet,
  }));
  return clip(
    `<web-search-results query="${query.replace(/"/g, '\\"')}">\n${escapeForDataBlock(
      JSON.stringify(payload, null, 2),
    )}\n</web-search-results>`,
    MAX_TOOL_RESULT_CHARS,
  );
}

/**
 * Executes one model-requested tool and returns the `tool` message content
 * plus a user-visible trace. Errors are returned as data so the model can
 * recover instead of breaking the whole turn.
 */
export async function executeTool(
  call: ToolCall,
  ctx: ToolContext,
): Promise<ToolExecution> {
  const name = call.function.name;
  const traceBase = {
    id: call.id,
    name,
    status: "running" as const,
    title: name,
  };

  try {
    const args = parseArgs(call.function.arguments);
    switch (name) {
      case "search_web": {
        const query = stringArg(args, "query");
        if (!query) throw new Error("Search query is required.");
        traceBase.title = query;
        const results = await searchWeb({
          fetch: ctx.fetch,
          baseUrl: ctx.searchBaseUrl,
          apiKey: ctx.searchApiKey,
          query,
          count: numberArg(args, "count"),
          oriQuestion: stringArg(args, "ori_question"),
        });
        return {
          content: formatSearchResults(query, results),
          trace: {
            ...traceBase,
            status: "ok",
            title: query,
            detail: `${results.length} result${results.length === 1 ? "" : "s"}`,
          },
        };
      }

      case "fetch_url": {
        const url = stringArg(args, "url");
        if (!url) throw new Error("URL is required.");
        if (!isSafeHttpUrl(url)) throw new Error("Refusing a non-public URL.");
        traceBase.title = url;
        const page = await fetchPage({
          fetch: ctx.fetch,
          baseUrl: ctx.searchBaseUrl,
          apiKey: ctx.searchApiKey,
          url,
        });
        const label = new URL(url).hostname;
        return {
          content: clip(
            `<fetched-page url="${url.replace(/"/g, '\\"')}">\n# ${
              page.title || label
            }\n\n${page.content}\n</fetched-page>`,
            MAX_TOOL_RESULT_CHARS,
          ),
          trace: {
            ...traceBase,
            status: "ok",
            title: page.title || label,
            detail: `${page.content.length.toLocaleString()} chars`,
          },
        };
      }

      case "add_paper_to_zotero": {
        if (!ctx.allowPaperDownloads) {
          throw new Error("Adding papers to Zotero is disabled in settings.");
        }
        const url = stringArg(args, "url");
        const title = stringArg(args, "title");
        if (!url || !title)
          throw new Error("A PDF URL and title are required.");
        if (!isSafeHttpUrl(url)) throw new Error("Refusing a non-public URL.");
        traceBase.title = title;

        const existing = await findExistingByDoi(
          ctx.libraryID,
          stringArg(args, "doi"),
        );
        if (existing) {
          const existingTitle = String(existing.getField("title") ?? title);
          return {
            content: JSON.stringify({
              status: "duplicate",
              itemID: existing.id,
              title: existingTitle,
            }),
            trace: {
              ...traceBase,
              status: "ok",
              title: existingTitle,
              detail: "Already in Zotero",
            },
          };
        }

        const request: PaperRequest = {
          url,
          title,
          doi: stringArg(args, "doi") || undefined,
          authors: stringArrayArg(args, "authors"),
          year: stringArg(args, "year") || undefined,
          abstract: stringArg(args, "abstract") || undefined,
        };
        const confirmed = await ctx.confirmPaper(request);
        if (!confirmed) {
          return {
            content: JSON.stringify({
              status: "declined",
              title,
              note: "The user declined to add this paper to Zotero.",
            }),
            trace: {
              ...traceBase,
              status: "ok",
              title,
              detail: "Cancelled by user",
            },
          };
        }

        const result = await addPaperToZotero(request, ctx);
        return {
          content: JSON.stringify(result),
          trace: {
            ...traceBase,
            status: "ok",
            title,
            detail:
              result.status === "added"
                ? "Added to Zotero"
                : result.status === "duplicate"
                  ? "Already in Zotero"
                  : "Not added",
          },
        };
      }

      case "ask_user": {
        const question = stringArg(args, "question");
        if (!question) throw new Error("Question is required.");
        traceBase.title = question;
        const options = stringArrayArg(args, "options").slice(0, 6);
        const ask: AskUserRequest = { question, options };
        const answer = await ctx.askUser(ask);
        return {
          content: `The user answered: ${answer}`,
          trace: {
            ...traceBase,
            status: "ok",
            title: question,
            detail: clip(answer, 120),
          },
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    if (isAbort(err)) throw err;
    const message = String((err as Error)?.message ?? err);
    return {
      content: `ERROR: ${message}`,
      trace: {
        ...traceBase,
        status: "error",
        title: traceBase.title,
        detail: clip(message, 200),
      },
    };
  }
}
