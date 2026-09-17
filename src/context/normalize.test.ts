import { describe, expect, it } from "vitest";

import { normalize } from "./normalize";

describe("normalize", () => {
  it("is idempotent", () => {
    const samples = [
      "",
      "hello",
      "\uFEFFhello\r\n\r\n\r\nworld  \r\n",
      "café",
      "a\n\n\n\nb\t\n c",
    ];
    for (const s of samples) {
      const once = normalize(s);
      expect(normalize(once)).toBe(once);
    }
  });

  it("strips BOM, unifies newlines, and collapses blank runs", () => {
    expect(normalize("\uFEFFfoo\r\n\r\n\r\nbar  \n")).toBe("foo\n\nbar");
  });
});
