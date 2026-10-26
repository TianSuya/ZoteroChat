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

function presentPapersTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "present_papers",
      description:
        "Note surface. Show a selectable candidate list and ask the user once before writing any of them. Call this after verifying candidates with search_library/read_pdf. The card is the confirmation: if the user selects and confirms, this tool adds exactly the selected papers in one batch; if the user cancels, nothing is written. Do not call add_paper_to_zotero for each paper in a batch.",
      parameters: {
        type: "object",
        properties: {
          note: {
            type: "string",
            description: "One short sentence shown above the candidate list.",
          },
          papers: {
            type: "array",
            description: "Candidate papers. Maximum 20 per card.",
            items: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "Direct public PDF URL.",
                },
                title: { type: "string" },
                doi: { type: "string" },
                authors: {
                  type: "array",
                  items: { type: "string" },
                },
                year: { type: "string" },
                venue: {
                  type: "string",
                  description: "Venue, track, or oral/poster status.",
                },
                abstract: { type: "string" },
              },
              required: ["url", "title"],
            },
          },
        },
        required: ["papers"],
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

function librarySearchTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "search_library",
      description:
        "Search the user's current Zotero collection, or the whole library when no collection is selected. Use this before proposing a paper to add, to avoid duplicates and to find PDFs already on disk. Returns itemID, title, authors, year, DOI and the PDF attachment itemID when present.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Title, author, year, DOI, or free-text terms from the paper.",
          },
          limit: {
            type: "integer",
            description: "Maximum matches, 1-20. Default 12.",
            minimum: 1,
            maximum: 20,
          },
        },
        required: ["query"],
      },
    },
  };
}

function readPdfTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "read_pdf",
      description:
        "Read the text of a PDF without adding it to the library. Pass a public PDF URL for a candidate found on the web, or an itemID from search_library for a paper already in Zotero. Use this to verify a candidate's content, venue, or claims before recommending or adding it. Remote PDFs are downloaded to a temporary attachment and erased immediately.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "Public http(s) URL to a PDF. arXiv abs/PDF and OpenReview forum links are accepted.",
          },
          itemID: {
            type: "integer",
            description:
              "Zotero itemID returned by search_library. Use instead of url for papers already in the library.",
          },
          title: {
            type: "string",
            description: "Optional title hint for a remote PDF.",
          },
        },
      },
    },
  };
}

function editNoteTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "edit_note",
      description:
        "Append or replace this standalone Zotero note. Use Markdown. Default to append for summaries, reading lists, or added context. Only use replace when the user explicitly asks to rewrite/replace the whole note. Existing note content is in <note-content>; do not duplicate a section that is already there.",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["append", "replace"],
            description: "append (default) or replace the whole note.",
          },
          content: {
            type: "string",
            description:
              "Markdown section to write. Use headings, bullets, links, and short paragraphs. Do not include HTML or scripts.",
          },
        },
        required: ["content"],
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
  /** Note surface adds library lookup, remote PDF reading, and note editing. */
  note?: boolean;
}): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  if (opts.search) tools.push(searchTool(), fetchTool());
  if (opts.note) {
    tools.push(
      librarySearchTool(),
      readPdfTool(),
      presentPapersTool(),
      editNoteTool(),
    );
  }
  if (opts.download) tools.push(addPaperTool());
  if (opts.askUser !== false) tools.push(askUserTool());
  return tools;
}
