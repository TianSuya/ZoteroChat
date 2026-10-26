import { describe, expect, it } from "vitest";

import { buildToolDefinitions } from "./definitions";

function names(opts: Parameters<typeof buildToolDefinitions>[0]): string[] {
  return buildToolDefinitions(opts).map((tool) => tool.function.name);
}

describe("buildToolDefinitions", () => {
  it("exposes search, download, and ask_user in the main thread", () => {
    expect(names({ search: true, download: true })).toEqual([
      "search_web",
      "fetch_url",
      "add_paper_to_zotero",
      "ask_user",
    ]);
  });

  it("can omit ask_user and download for asides", () => {
    expect(names({ search: true, download: false, askUser: false })).toEqual([
      "search_web",
      "fetch_url",
    ]);
  });

  it("keeps ask_user when search is disabled", () => {
    expect(names({ search: false, download: false })).toEqual(["ask_user"]);
  });

  it("adds library, PDF, batch, and note editing in note mode", () => {
    expect(names({ search: true, download: true, note: true })).toEqual([
      "search_web",
      "fetch_url",
      "search_library",
      "read_pdf",
      "present_papers",
      "edit_note",
      "add_paper_to_zotero",
      "ask_user",
    ]);
  });
});
