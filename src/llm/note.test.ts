import { describe, expect, it } from "vitest";
import { renderNoteEdit } from "./note";

const current =
  '<div data-schema-version="9"><h1>My note</h1><p>Existing paragraph.</p></div>';

describe("renderNoteEdit", () => {
  it("appends inside the Zotero note wrapper", () => {
    const next = renderNoteEdit(current, "## Summary\n\n- Key point", "append");
    expect(next).toContain("Existing paragraph.");
    expect(next).toContain("<h2>Summary</h2>");
    expect(next.indexOf("<h2>Summary</h2>")).toBeLessThan(
      next.lastIndexOf("</div>"),
    );
  });

  it("replaces the whole note when explicitly asked", () => {
    const next = renderNoteEdit(current, "## New note", "replace");
    expect(next).not.toContain("Existing paragraph.");
    expect(next).toContain("<h2>New note</h2>");
  });

  it("rejects an empty section", () => {
    expect(() => renderNoteEdit(current, "   ", "append")).toThrow(/empty/);
  });
});
