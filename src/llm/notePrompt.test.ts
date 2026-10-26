import { describe, expect, it } from "vitest";
import { noteConversationKey } from "./notePrompt";

describe("note conversation", () => {
  it("keys history by library and note key", () => {
    expect(noteConversationKey({ libraryID: 1, noteKey: "ABCD1234" })).toBe(
      "note:1:ABCD1234",
    );
  });
});
