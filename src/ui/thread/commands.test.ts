import { describe, expect, it } from "vitest";

import { commandsFor, matchingCommands, slashQuery } from "../../i18n/commands";

describe("slashQuery", () => {
  it("returns the query after a leading slash", () => {
    expect(slashQuery("/sum")).toBe("sum");
    expect(slashQuery("/")).toBe("");
  });

  it("ignores anything that is not a slash command in progress", () => {
    expect(slashQuery("")).toBeNull();
    expect(slashQuery("summarize")).toBeNull();
    expect(slashQuery("/sum marize")).toBeNull();
    expect(slashQuery("/sum\n")).toBeNull();
  });
});

describe("matchingCommands", () => {
  it("lists every command for an empty query", () => {
    expect(matchingCommands("", "en").map((c) => c.slash)).toEqual([
      "summarize",
      "explain",
      "limitations",
      "terms",
    ]);
  });

  it("filters by slash prefix", () => {
    expect(matchingCommands("sum", "en").map((c) => c.slash)).toEqual([
      "summarize",
    ]);
  });

  it("matches localized labels", () => {
    expect(matchingCommands("概括", "zh-CN").map((c) => c.id)).toEqual([
      "summarize",
    ]);
  });
});

describe("commandsFor", () => {
  it("writes Chinese prompts for zh-CN", () => {
    const summarize = commandsFor("zh-CN").find((c) => c.id === "summarize");
    expect(summarize?.label).toBe("概括全文");
    expect(summarize?.prompt).toMatch(/不要把英文原句嵌进中文/);
  });

  it("writes English prompts for en", () => {
    const summarize = commandsFor("en").find((c) => c.id === "summarize");
    expect(summarize?.label).toBe("Summarize");
    expect(summarize?.prompt).toMatch(/Stick to claims/);
  });
});
