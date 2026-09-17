import { describe, expect, it } from "vitest";

import { encodeUserContent, parseUserContent } from "./userContent";

describe("encodeUserContent / parseUserContent", () => {
  it("round-trips a question with a selection", () => {
    const raw = encodeUserContent("这段在说什么？", {
      text: "Attention is all you need",
      page: 3,
    });
    expect(parseUserContent(raw)).toEqual({
      question: "这段在说什么？",
      selection: { text: "Attention is all you need", page: 3 },
    });
  });

  it("leaves a plain question unchanged", () => {
    expect(parseUserContent("hello")).toEqual({
      question: "hello",
      selection: null,
    });
  });
});
