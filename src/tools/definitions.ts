import type { ToolDefinition } from "../llm/types";

function searchTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Search the live web with DeepSeek Search. Use it when the answer depends on information beyond the paper: related work, publication status, newer results, or a specific paper the user asked for. Do not use it for facts already present in <document>.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query, 1-128 characters. Supports site:, lang:, after:, before:, quoted phrases, and -exclusions.",
          },
          ori_question: {
            type: "string",
            description:
              "The user's original question, 1-128 characters. Helps the search engine understand intent.",
          },
          count: {
            type: "integer",
            description: "Number of results, 1-10. Default 5.",
            minimum: 1,
            maximum: 10,
          },
        },
        required: ["query"],
      },
    },
  };
}

function fetchTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Fetch one web page as Markdown with DeepSeek Fetch. Use it to read a promising search result before citing it. Do not fetch PDF files with this tool; use add_paper_to_zotero for PDFs.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The http(s) page URL to read.",
          },
        },
        required: ["url"],
      },
    },
  };
}

function addPaperTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "add_paper_to_zotero",
      description:
        "Download a paper PDF and add it to the user's Zotero library. The user is asked to confirm every write before it happens. Only call this when the user explicitly asked to download or save a paper, and only with a direct PDF URL (for example an arxiv.org/pdf/... link). Never fabricate a DOI, title, authors, or year.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "Direct http(s) URL to the PDF. arxiv.org/abs/... and openreview.net/forum?id=... are also accepted.",
          },
          title: {
            type: "string",
            description: "Paper title. Required and shown in the confirmation.",
          },
          doi: {
            type: "string",
            description: "DOI if known. Used for duplicate detection.",
          },
          authors: {
            type: "array",
            items: { type: "string" },
            description: "Author names as 'First Last', if known.",
          },
          year: {
            type: "string",
            description: "Publication year, if known.",
          },
          abstract: {
            type: "string",
            description: "Abstract, if available from the search result.",
          },
        },
        required: ["url", "title"],
      },
    },
  };
}

function askUserTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "ask_user",
      description:
        "Ask the user a clarifying question and wait for the answer. Use it when a choice materially changes what you do and cannot be inferred from the conversation. Do not use it for obvious confirmations. Provide short options when the answer is a small set of choices.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question to show the user.",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional quick choices, at most 6. The user can still type a free-form answer.",
          },
        },
        required: ["question"],
      },
    },
  };
}

/**
 * Tool schemas are request-level, so they do not enter the frozen paper
 * prefix. Keep their order and wording stable so the provider can cache the
 * prompt around them.
 */
export function buildToolDefinitions(opts: {
  search: boolean;
  download: boolean;
  /** Asides currently only retrieve; ask_user stays in the main thread. */
  askUser?: boolean;
}): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  if (opts.search) tools.push(searchTool(), fetchTool());
  if (opts.download) tools.push(addPaperTool());
  if (opts.askUser !== false) tools.push(askUserTool());
  return tools;
}
